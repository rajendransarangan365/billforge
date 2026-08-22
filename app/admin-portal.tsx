// @ts-nocheck
import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  Alert, ActivityIndicator, RefreshControl, Modal, Dimensions,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../src/theme';
import { useAuth } from '../src/context/AuthContext';
import {
  getDatabase, authenticateAdmin, getAllQuarries, registerQuarry, getGlobalDrivers,
  resetQuarryPassword, approveQuarry, rejectQuarry,
} from '../src/database/db';

export default function AdminPortalScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, isAdmin, loginAdmin, loginOwner, logout } = useAuth();

  // Auth state if not admin
  const [adminEmail, setAdminEmail] = useState('sarangan365@gmail.com');
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [pinLoading, setPinLoading] = useState(false);

  // Active Tab
  const [activeTab, setActiveTab] = useState<'quarries' | 'drivers' | 'settings'>('quarries');

  // Reset Pass Modal
  const [resetModalVisible, setResetModalVisible] = useState(false);
  const [resetTargetQuarry, setResetTargetQuarry] = useState<any>(null);
  const [generatedTempPass, setGeneratedTempPass] = useState('');
  const [resetEmailSent, setResetEmailSent] = useState(false);

  // SMTP Settings State
  const [smtpUser, setSmtpUser] = useState('rightsight365@gmail.com');
  const [smtpPass, setSmtpPass] = useState('ktgvoitoxfhijqmr');
  const [smtpHost, setSmtpHost] = useState('smtp.gmail.com');
  const [smtpPort, setSmtpPort] = useState('465');
  const [adminNoticeEmail, setAdminNoticeEmail] = useState('sarangan365@gmail.com');
  const [smtpSaving, setSmtpSaving] = useState(false);
  const [smtpMsg, setSmtpMsg] = useState('');


  // Admin dashboard state
  const [quarries, setQuarries] = useState<any[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Register quarry modal state
  const [modalVisible, setModalVisible] = useState(false);
  const [regName, setRegName] = useState('');
  const [regOwner, setRegOwner] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regPassword, setRegPassword] = useState('admin123');
  const [regLocation, setRegLocation] = useState('');
  const [regAddress, setRegAddress] = useState('');
  const [regSaving, setRegSaving] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const db = await getDatabase();
      const qList = await getAllQuarries(db);
      const dList = await getGlobalDrivers(db);
      setQuarries(qList);
      setDrivers(dList);
    } catch (e) {
      console.error('Admin Load Error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) {
      loadData();
    }
  }, [isAdmin, loadData]);

  const handlePinSubmit = async () => {
    setPinError('');
    if (!adminEmail.trim()) { setPinError('Enter Admin Email Address'); return; }
    if (!pin.trim()) { setPinError('Enter master PIN / password'); return; }
    setPinLoading(true);
    try {
      const db = await getDatabase();
      const res = await authenticateAdmin(db, adminEmail.trim(), pin.trim());
      if (res) {
        loginAdmin(res);
        loadData();
      } else {
        setPinError('Invalid Admin Email or Master PIN.');
      }
    } catch (e) {
      setPinError('Authentication error');
    } finally {
      setPinLoading(false);
    }
  };


  const handleRegisterQuarry = async () => {
    if (!regName.trim() || !regPhone.trim()) {
      Alert.alert('Required Fields', 'Please enter Quarry Name and Mobile Number.');
      return;
    }
    setRegSaving(true);
    try {
      const db = await getDatabase();
      await registerQuarry(db, {
        name: regName.trim(),
        owner_name: regOwner.trim() || regName.trim(),
        phone: regPhone.trim(),
        password: regPassword.trim() || 'admin123',
        location: regLocation.trim(),
        address: regAddress.trim(),
      });
      Alert.alert('Success', `Quarry "${regName}" registered successfully!`);
      setModalVisible(false);
      setRegName(''); setRegOwner(''); setRegPhone(''); setRegLocation(''); setRegAddress('');
      loadData();
    } catch (e) {
      Alert.alert('Error', e.message || 'Failed to register quarry.');
    } finally {
      setRegSaving(false);
    }
  };

  const openResetPassModal = async (quarry: any) => {
    const tempPass = `temp${Math.floor(1000 + Math.random() * 9000)}`;
    setResetTargetQuarry(quarry);
    setGeneratedTempPass(tempPass);
    setResetEmailSent(false);

    try {
      const db = await getDatabase();
      await resetQuarryPassword(db, quarry.id, tempPass);
    } catch (e) {
      console.error('Reset pass error:', e);
    }
    setResetModalVisible(true);
  };

  const handleSendResetEmail = async () => {
    if (!resetTargetQuarry) return;
    try {
      const { sendPasswordResetEmail } = require('../src/services/emailService');
      await sendPasswordResetEmail({
        toEmail: resetTargetQuarry.email || adminNoticeEmail || 'sarangan365@gmail.com',
        ownerName: resetTargetQuarry.owner_name || resetTargetQuarry.name,
        quarryName: resetTargetQuarry.name,
        tempPassword: generatedTempPass,
      });
      setResetEmailSent(true);
      Alert.alert('Email Dispatched ✉️', `Temporary passcode email sent to ${resetTargetQuarry.email || adminNoticeEmail || 'sarangan365@gmail.com'}`);
    } catch (e) {
      Alert.alert('Error', 'Failed to dispatch email.');
    }
  };


  const handleApprove = async (quarry: any) => {
    try {
      const qid = typeof quarry === 'object' ? quarry.id : quarry;
      const qname = typeof quarry === 'object' ? quarry.name : 'Quarry';
      const qemail = typeof quarry === 'object' ? quarry.email : 'sarangan365@gmail.com';
      const qowner = typeof quarry === 'object' ? quarry.owner_name : 'Owner';

      const db = await getDatabase();
      await approveQuarry(db, qid);

      // Dispatch Onboarding Approval Email
      try {
        const { sendOnboardingEmail } = require('../src/services/emailService');
        await sendOnboardingEmail({
          toEmail: qemail || 'sarangan365@gmail.com',
          ownerName: qowner || qname,
          quarryName: qname,
          status: 'active',
        });
      } catch (err) {}

      Alert.alert('Business Approved ✅', `Quarry "${qname}" is now ACTIVE. Approval email sent to ${qemail || 'sarangan365@gmail.com'}.`);
      loadData();
    } catch (e) {
      Alert.alert('Error', 'Failed to approve quarry.');
    }
  };

  const handleReject = async (quarryId: number, name: string) => {
    try {
      const db = await getDatabase();
      await rejectQuarry(db, quarryId);
      Alert.alert('Business Rejected ❌', `Quarry "${name}" registration has been rejected.`);
      loadData();
    } catch (e) {
      Alert.alert('Error', 'Failed to reject quarry.');
    }
  };

  // Security Modal State for Admin Accessing Quarry
  const [accessModalVisible, setAccessModalVisible] = useState(false);
  const [targetQuarry, setTargetQuarry] = useState<any>(null);
  const [accessPassword, setAccessPassword] = useState('');
  const [accessError, setAccessError] = useState('');

  const openAccessModal = (quarry: any) => {
    setTargetQuarry(quarry);
    setAccessPassword('');
    setAccessError('');
    setAccessModalVisible(true);
  };

  const handleConfirmQuarryAccess = () => {
    if (!accessPassword.trim()) {
      setAccessError('Please enter Quarry Password or Admin Master PIN.');
      return;
    }
    const validQuarryPass = targetQuarry?.password || 'owner123';
    if (accessPassword.trim() === validQuarryPass || accessPassword.trim() === 'admin123') {
      setAccessModalVisible(false);
      loginOwner({
        id: targetQuarry.id,
        quarry_id: targetQuarry.id,
        name: targetQuarry.name,
        owner_name: targetQuarry.owner_name,
        phone: targetQuarry.phone,
        location: targetQuarry.location,
        address: targetQuarry.address,
        role: 'quarry_owner',
      });
      router.push('/(tabs)');
    } else {
      setAccessError('Invalid password / Master PIN. Verification failed.');
    }
  };


  // If not logged in as Admin, show PIN entry modal
  // If not logged in as Admin, show FULLSCREEN PIN entry overlay (completely hiding sidebar & navigation)
  if (!isAdmin) {
    return (
      <View style={styles.fullscreenAuthOverlay}>
        <View style={styles.pinCard}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={20} color={Colors.text} />
          </TouchableOpacity>
          <View style={styles.pinIconWrap}>
            <Ionicons name="shield-checkmark" size={36} color="#E65100" />
          </View>
          <Text style={styles.pinTitle}>Admin Control Tower</Text>
          <Text style={styles.pinSub}>Enter Admin Credentials to access platform administration</Text>

          <View style={{ gap: 12, marginTop: 12 }}>
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Admin Email Address</Text>
              <View style={styles.inputWrap}>
                <Ionicons name="mail-outline" size={18} color={Colors.textTertiary} style={{ paddingLeft: 12 }} />
                <TextInput
                  style={styles.pinInput}
                  value={adminEmail}
                  onChangeText={setAdminEmail}
                  placeholder="admin@billforge.in"
                  placeholderTextColor={Colors.textDisabled}
                  keyboardType="email-address"
                />
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Master PIN / Password</Text>
              <View style={styles.inputWrap}>
                <Ionicons name="lock-closed-outline" size={18} color={Colors.textTertiary} style={{ paddingLeft: 12 }} />
                <TextInput
                  style={styles.pinInput}
                  value={pin}
                  onChangeText={setPin}
                  placeholder="Enter Master PIN"
                  placeholderTextColor={Colors.textDisabled}
                  secureTextEntry
                  onSubmitEditing={handlePinSubmit}
                />
              </View>
            </View>
          </View>

          {pinError ? (
            <View style={[styles.errorBox, { marginTop: 12 }]}>
              <Ionicons name="alert-circle-outline" size={14} color={Colors.danger} />
              <Text style={styles.errorText}>{pinError}</Text>
            </View>
          ) : null}

          <TouchableOpacity
            style={[styles.btnPrimary, { backgroundColor: '#E65100', marginTop: 16 }, pinLoading && { opacity: 0.7 }]}
            onPress={handlePinSubmit}
            disabled={pinLoading}
          >
            {pinLoading ? (
              <ActivityIndicator color="#FFF" size="small" />
            ) : (
              <>
                <Text style={styles.btnText}>Authenticate Admin 🔐</Text>
                <Ionicons name="key-outline" size={18} color="#FFF" />
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  }


  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.push('/select-role')} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={20} color={Colors.navy} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Admin Control Tower</Text>
          <Text style={styles.subTitle}>Platform Oversight & Multi-Quarry Operations</Text>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={() => setModalVisible(true)}>
          <Ionicons name="add-circle" size={18} color="#FFF" />
          <Text style={styles.addBtnText}>Add Quarry</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.centerWrap}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={{ marginTop: 8, color: Colors.textSecondary }}>Loading Platform Data...</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.content}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} colors={[Colors.primary]} tintColor={Colors.primary} />}
          showsVerticalScrollIndicator={false}
        >
          {/* Dashboard Tab Selector */}
          <View style={{ flexDirection: 'row', backgroundColor: Colors.surface, borderRadius: 12, padding: 4, marginBottom: 20, borderWidth: 1, borderColor: Colors.borderLight }}>
            <TouchableOpacity
              style={[{ flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center' }, activeTab === 'quarries' && { backgroundColor: Colors.primarySurface, borderWidth: 1, borderColor: Colors.primaryBorder }]}
              onPress={() => setActiveTab('quarries')}
            >
              <Text style={{ fontSize: 13, fontWeight: '700', color: activeTab === 'quarries' ? Colors.primary : Colors.textSecondary }}>🏢 Quarries ({quarries.length})</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[{ flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center' }, activeTab === 'drivers' && { backgroundColor: Colors.infoLight, borderWidth: 1, borderColor: Colors.infoBorder }]}
              onPress={() => setActiveTab('drivers')}
            >
              <Text style={{ fontSize: 13, fontWeight: '700', color: activeTab === 'drivers' ? Colors.info : Colors.textSecondary }}>🚚 Fleet ({drivers.length})</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[{ flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center' }, activeTab === 'settings' && { backgroundColor: '#FFF3E0', borderWidth: 1, borderColor: '#FFE0B2' }]}
              onPress={() => setActiveTab('settings')}
            >
              <Text style={{ fontSize: 13, fontWeight: '700', color: activeTab === 'settings' ? '#E65100' : Colors.textSecondary }}>⚙️ SMTP & Mail</Text>
            </TouchableOpacity>
          </View>

          {activeTab === 'settings' ? (
            <View style={{ gap: 16 }}>
              <Text style={styles.sectionTitle}>⚙️ SMTP & Admin Email Settings</Text>
              <Text style={{ fontSize: 13, color: Colors.textSecondary, marginTop: -8 }}>
                Configure SMTP email dispatch server credentials & admin notification address for Vercel production emails.
              </Text>

              <View style={styles.quarryCard}>
                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>Admin Notification Email Address</Text>
                  <View style={styles.inputWrap}>
                    <Ionicons name="mail-outline" size={18} color={Colors.textTertiary} style={{ paddingLeft: 12 }} />
                    <TextInput
                      style={styles.pinInput}
                      value={adminNoticeEmail}
                      onChangeText={setAdminNoticeEmail}
                      placeholder="e.g. sarangan365@gmail.com"
                      keyboardType="email-address"
                    />
                  </View>
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>SMTP User / Sender Address</Text>
                  <View style={styles.inputWrap}>
                    <Ionicons name="at-outline" size={18} color={Colors.textTertiary} style={{ paddingLeft: 12 }} />
                    <TextInput
                      style={styles.pinInput}
                      value={smtpUser}
                      onChangeText={setSmtpUser}
                      placeholder="e.g. rightsight365@gmail.com"
                      keyboardType="email-address"
                    />
                  </View>
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>SMTP App Password (Gmail / Provider App Password)</Text>
                  <View style={styles.inputWrap}>
                    <Ionicons name="key-outline" size={18} color={Colors.textTertiary} style={{ paddingLeft: 12 }} />
                    <TextInput
                      style={styles.pinInput}
                      value={smtpPass}
                      onChangeText={setSmtpPass}
                      placeholder="Enter app password"
                      secureTextEntry
                    />
                  </View>
                </View>

                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <View style={[styles.fieldGroup, { flex: 2 }]}>
                    <Text style={styles.label}>SMTP Host</Text>
                    <View style={styles.inputWrap}>
                      <Ionicons name="server-outline" size={18} color={Colors.textTertiary} style={{ paddingLeft: 12 }} />
                      <TextInput
                        style={styles.pinInput}
                        value={smtpHost}
                        onChangeText={setSmtpHost}
                        placeholder="smtp.gmail.com"
                      />
                    </View>
                  </View>

                  <View style={[styles.fieldGroup, { flex: 1 }]}>
                    <Text style={styles.label}>Port</Text>
                    <View style={styles.inputWrap}>
                      <TextInput
                        style={[styles.pinInput, { paddingLeft: 12 }]}
                        value={smtpPort}
                        onChangeText={setSmtpPort}
                        placeholder="465"
                        keyboardType="numeric"
                      />
                    </View>
                  </View>
                </View>

                <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
                  <TouchableOpacity
                    style={[styles.btnPrimary, { flex: 1, backgroundColor: Colors.primary }]}
                    onPress={() => {
                      try {
                        const { saveSMTPConfig } = require('../src/services/emailService');
                        saveSMTPConfig({
                          user: smtpUser,
                          pass: smtpPass,
                          host: smtpHost,
                          port: parseInt(smtpPort) || 465,
                          toMeEmail: adminNoticeEmail,
                        });
                        Alert.alert('Settings Saved 💾', 'SMTP configuration & Admin Email updated successfully.');
                      } catch (e) {
                        Alert.alert('Error', 'Failed to save settings.');
                      }
                    }}
                  >
                    <Ionicons name="save-outline" size={18} color="#FFF" />
                    <Text style={styles.btnText}>Save Settings</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.btnPrimary, { backgroundColor: '#2E7D32' }]}
                    onPress={async () => {
                      try {
                        const { sendPasswordResetEmail } = require('../src/services/emailService');
                        const res = await sendPasswordResetEmail({
                          toEmail: adminNoticeEmail,
                          ownerName: 'Platform Admin',
                          quarryName: 'BillForge System Test',
                          tempPassword: 'TEST-1234-PASS',
                        });
                        if (res.success) {
                          Alert.alert('Test Success 🎉', `Test email dispatched to ${adminNoticeEmail}!`);
                        } else {
                          Alert.alert('Test Failed', res.error || 'Dispatch error');
                        }
                      } catch (e) {
                        Alert.alert('Error', e.message || 'Test failed.');
                      }
                    }}
                  >
                    <Ionicons name="paper-plane-outline" size={18} color="#FFF" />
                    <Text style={styles.btnText}>Test Email ✉️</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          ) : activeTab === 'drivers' ? (
            <View style={{ gap: 14 }}>
              <Text style={styles.sectionTitle}>Global Driver Pool ({drivers.length})</Text>
              {drivers.map(d => (
                <View key={d.id} style={styles.quarryCard}>
                  <View style={styles.quarryHeader}>
                    <View style={[styles.quarryAvatar, { backgroundColor: Colors.infoLight }]}>
                      <Ionicons name="car-sport" size={20} color={Colors.info} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.quarryName}>{d.name}</Text>
                      <Text style={styles.quarryOwner}>Vehicle: {d.vehicle_no || 'Lorry'} • Mobile: {d.phone}</Text>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: '#E3F2FD' }]}>
                      <Text style={[styles.statusBadgeText, { color: '#1565C0' }]}>AVAILABLE</Text>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <>
          {/* Platform Metrics */}
          <Text style={styles.sectionTitle}>Platform Overview</Text>
          <View style={styles.grid}>
            <View style={[styles.gridCard, { backgroundColor: Colors.primarySurface }]}>
              <Text style={[styles.gridNum, { color: Colors.primary }]}>{quarries.length}</Text>
              <Text style={styles.gridLbl}>Registered Quarries</Text>
            </View>
            <View style={[styles.gridCard, { backgroundColor: Colors.infoLight }]}>
              <Text style={[styles.gridNum, { color: Colors.info }]}>{drivers.length}</Text>
              <Text style={styles.gridLbl}>Registered Drivers</Text>
            </View>
            <View style={[styles.gridCard, { backgroundColor: Colors.successLight }]}>
              <Text style={[styles.gridNum, { color: Colors.success }]}>{quarries.filter(q => q.status === 'active').length}</Text>
              <Text style={styles.gridLbl}>Active Outlets</Text>
            </View>
          </View>


          {/* Pending Business Approvals Section */}
          {quarries.filter(q => q.status === 'pending_approval').length > 0 && (
            <View style={{ marginBottom: 20 }}>
              <Text style={[styles.sectionTitle, { color: '#D97706' }]}>
                ⏳ Pending Business Approvals ({quarries.filter(q => q.status === 'pending_approval').length})
              </Text>
              {quarries.filter(q => q.status === 'pending_approval').map(q => (
                <View key={q.id} style={[styles.quarryCard, { borderColor: '#FDE68A', backgroundColor: '#FFFBEB' }]}>
                  <View style={styles.quarryHeader}>
                    <View style={[styles.quarryAvatar, { backgroundColor: '#FEF3C7' }]}>
                      <Ionicons name="time" size={20} color="#D97706" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.quarryName}>{q.name}</Text>
                      <Text style={styles.quarryOwner}>Owner: {q.owner_name} ({q.phone})</Text>
                      {q.location ? <Text style={styles.quarryLoc}><Ionicons name="location-outline" size={12} /> {q.location}</Text> : null}
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: '#FEF3C7' }]}>
                      <Text style={[styles.statusBadgeText, { color: '#D97706' }]}>PENDING</Text>
                    </View>
                  </View>
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
                    <TouchableOpacity style={[styles.manageBtn, { flex: 1, backgroundColor: Colors.success, borderColor: Colors.success }]} onPress={() => handleApprove(q)}>
                      <Ionicons name="checkmark-circle" size={16} color="#FFF" />
                      <Text style={[styles.manageBtnText, { color: '#FFF' }]}>Approve Business ✅</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.manageBtn, { flex: 1, backgroundColor: Colors.dangerLight, borderColor: Colors.dangerBorder }]} onPress={() => handleReject(q.id, q.name)}>
                      <Ionicons name="close-circle" size={16} color={Colors.danger} />
                      <Text style={[styles.manageBtnText, { color: Colors.danger }]}>Reject ❌</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Quarry Directory */}
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Registered Quarries ({quarries.length})</Text>
            <TouchableOpacity onPress={() => setModalVisible(true)}>
              <Text style={styles.linkText}>+ Register New</Text>
            </TouchableOpacity>
          </View>

          {quarries.length === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons name="business-outline" size={32} color={Colors.textDisabled} />
              <Text style={styles.emptyText}>No quarries registered yet.</Text>
              <TouchableOpacity style={[styles.btnPrimary, { marginTop: 12, backgroundColor: Colors.primary }]} onPress={() => setModalVisible(true)}>
                <Text style={styles.btnText}>Register First Quarry</Text>
              </TouchableOpacity>
            </View>
          ) : (
            quarries.map((q) => (
              <View key={q.id} style={styles.quarryCard}>
                <View style={styles.quarryHeader}>
                  <View style={styles.quarryAvatar}>
                    <Ionicons name="business" size={20} color={Colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.quarryName}>{q.name}</Text>
                    <Text style={styles.quarryOwner}>Owner: {q.owner_name} ({q.phone})</Text>
                    {q.location ? <Text style={styles.quarryLoc}><Ionicons name="location-outline" size={12} /> {q.location}</Text> : null}
                  </View>
                  <View style={styles.statusBadge}>
                    <Text style={styles.statusBadgeText}>ACTIVE</Text>
                  </View>
                </View>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TouchableOpacity style={[styles.manageBtn, { flex: 1 }]} onPress={() => openAccessModal(q)}>
                    <Ionicons name="open-outline" size={16} color={Colors.primary} />
                    <Text style={styles.manageBtnText}>Manage & View Bills</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.manageBtn, { backgroundColor: '#FFF3E0', borderColor: '#FFE0B2' }]} onPress={() => openResetPassModal(q)}>
                    <Ionicons name="key-outline" size={16} color="#E65100" />
                    <Text style={[styles.manageBtnText, { color: '#E65100' }]}>Reset Temp Pass</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
          </>
          )}
        </ScrollView>
      )}




      {/* Modal: Add Quarry */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Register New Quarry</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={22} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 400 }} showsVerticalScrollIndicator={false}>
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Quarry Name *</Text>
                <TextInput style={styles.formInput} value={regName} onChangeText={setRegName} placeholder="e.g. Sri Murugan Blue Metal Quarry" />
              </View>
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Owner Name</Text>
                <TextInput style={styles.formInput} value={regOwner} onChangeText={setRegOwner} placeholder="e.g. K. Ramasamy" />
              </View>
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Mobile Number (Owner Login) *</Text>
                <TextInput style={styles.formInput} value={regPhone} onChangeText={setRegPhone} placeholder="10-digit mobile number" keyboardType="phone-pad" />
              </View>
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Login Password</Text>
                <TextInput style={styles.formInput} value={regPassword} onChangeText={setRegPassword} placeholder="Default: admin123" />
              </View>
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Quarry Location / District</Text>
                <TextInput style={styles.formInput} value={regLocation} onChangeText={setRegLocation} placeholder="e.g. Tiruppur" />
              </View>
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Full Address</Text>
                <TextInput style={styles.formInput} value={regAddress} onChangeText={setRegAddress} placeholder="Survey No 142, Main Quarry Road" />
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setModalVisible(false)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.saveBtn, regSaving && { opacity: 0.7 }]} onPress={handleRegisterQuarry} disabled={regSaving}>
                {regSaving ? <ActivityIndicator color="#FFF" size="small" /> : <Text style={styles.saveText}>Save & Create Quarry</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal: Admin Password Security Access Authorization */}
      <Modal visible={accessModalVisible} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, { maxWidth: 420 }]}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="lock-closed" size={20} color="#E65100" />
                <Text style={styles.modalTitle}>Security Access Prompt</Text>
              </View>
              <TouchableOpacity onPress={() => setAccessModalVisible(false)}>
                <Ionicons name="close" size={22} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={{ fontSize: 13, color: Colors.textSecondary, marginBottom: 16 }}>
              Enter password for <Text style={{ fontWeight: '700', color: Colors.navy }}>{targetQuarry?.name}</Text> or Master Admin PIN (admin123) to access quarry operations:
            </Text>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Quarry Password or Master PIN *</Text>
              <TextInput
                style={styles.formInput}
                value={accessPassword}
                onChangeText={setAccessPassword}
                placeholder="Enter password or Master PIN"
                secureTextEntry
                autoFocus
                onSubmitEditing={handleConfirmQuarryAccess}
              />
            </View>

            {accessError ? (
              <View style={[styles.errorBox, { marginBottom: 12 }]}>
                <Ionicons name="alert-circle-outline" size={14} color={Colors.danger} />
                <Text style={styles.errorText}>{accessError}</Text>
              </View>
            ) : null}

            <View style={styles.modalFooter}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setAccessModalVisible(false)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.saveBtn, { backgroundColor: '#E65100' }]} onPress={handleConfirmQuarryAccess}>
                <Text style={styles.saveText}>Authorize Access 🔓</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>


      {/* Dedicated Reset Pass Modal with Direct Phone Call Support */}
      {resetModalVisible && resetTargetQuarry && (
        <Modal visible={resetModalVisible} animationType="fade" transparent>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContainer}>
              <View style={styles.modalHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Ionicons name="key" size={22} color="#E65100" />
                  <Text style={styles.modalTitle}>Temporary Password Reset</Text>
                </View>
                <TouchableOpacity onPress={() => setResetModalVisible(false)}>
                  <Ionicons name="close" size={22} color={Colors.textSecondary} />
                </TouchableOpacity>
              </View>

              <View style={{ gap: 14 }}>
                <Text style={{ fontSize: 13, color: Colors.textSecondary }}>
                  Temporary passcode generated for <Text style={{ fontWeight: '800', color: Colors.navy }}>{resetTargetQuarry.name}</Text>:
                </Text>

                <View style={{ backgroundColor: '#FFF3E0', padding: 18, borderRadius: 12, alignItems: 'center', borderWidth: 1.5, borderColor: '#FFE0B2' }}>
                  <Text style={{ fontSize: 26, fontWeight: '900', color: '#E65100', letterSpacing: 2 }}>{generatedTempPass}</Text>
                  <Text style={{ fontSize: 11, color: '#D97706', marginTop: 4 }}>Valid for 1-time login & password reset</Text>
                </View>

                {/* Call Owner Direct Support Card */}
                <View style={{ backgroundColor: '#F8FAFC', padding: 14, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', gap: 8 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Ionicons name="call" size={16} color={Colors.primary} />
                    <Text style={{ fontSize: 13, fontWeight: '700', color: Colors.navy }}>Direct Support & Phone Call Verification</Text>
                  </View>
                  <Text style={{ fontSize: 12, color: Colors.textSecondary, lineHeight: 17 }}>
                    Quarry Owner Mobile: <Text style={{ fontWeight: '700', color: Colors.text }}>{resetTargetQuarry.phone}</Text>
                  </Text>
                  <Text style={{ fontSize: 12, color: Colors.textSecondary, lineHeight: 17 }}>
                    Developer Support Hotline: <Text style={{ fontWeight: '700', color: Colors.text }}>+91 9894698049</Text>
                  </Text>

                  <TouchableOpacity
                    style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#2E7D32', paddingVertical: 10, borderRadius: 10, gap: 6, marginTop: 4 }}
                    onPress={() => typeof window !== 'undefined' && window.open ? window.open(`tel:${resetTargetQuarry.phone}`) : null}
                  >
                    <Ionicons name="call-outline" size={16} color="#FFF" />
                    <Text style={{ fontSize: 13, fontWeight: '800', color: '#FFF' }}>Call Owner Directly ({resetTargetQuarry.phone}) 📞</Text>
                  </TouchableOpacity>
                </View>

                {/* Email option */}
                <TouchableOpacity
                  style={[{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: 10, borderWidth: 1.5, borderColor: Colors.primaryBorder, backgroundColor: Colors.primarySurface, gap: 6 }, resetEmailSent && { backgroundColor: '#E8F5E9', borderColor: '#A5D6A7' }]}
                  onPress={handleSendResetEmail}
                >
                  <Ionicons name={resetEmailSent ? "checkmark-circle" : "mail-outline"} size={16} color={resetEmailSent ? "#2E7D32" : Colors.primary} />
                  <Text style={{ fontSize: 13, fontWeight: '700', color: resetEmailSent ? "#2E7D32" : Colors.primary }}>
                    {resetEmailSent ? 'Email Notification Sent ✅' : '✉️ Send Email to ' + (resetTargetQuarry.email || adminNoticeEmail)}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity style={[styles.btnPrimary, { backgroundColor: Colors.navy, marginTop: 4 }]} onPress={() => setResetModalVisible(false)}>
                  <Text style={styles.btnText}>Close / Done</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}


const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  fullscreenAuthOverlay: {
    position: 'absolute',
    top: 0, bottom: 0, left: 0, right: 0,
    width: '100%', height: '100%',
    backgroundColor: '#F8FAFC',
    justifyContent: 'center', alignItems: 'center',
    paddingHorizontal: 20,
    zIndex: 999999,
  },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.borderLight, gap: 12 },
  backBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: Colors.background, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.border },
  title: { fontSize: 18, fontWeight: '800', color: Colors.navy },
  subTitle: { fontSize: 11, color: Colors.textSecondary },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.primary, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  addBtnText: { fontSize: 13, fontWeight: '700', color: '#FFF' },
  centerWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { flex: 1 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: Colors.textTertiary, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 20, marginBottom: 10 },
  linkText: { fontSize: 13, fontWeight: '700', color: Colors.primary },
  grid: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  gridCard: { flex: 1, padding: 14, borderRadius: 12, alignItems: 'center' },
  gridNum: { fontSize: 22, fontWeight: '900' },
  gridLbl: { fontSize: 11, color: Colors.textSecondary, marginTop: 2, textAlign: 'center' },
  quarryCard: { backgroundColor: Colors.surface, borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: Colors.borderLight, gap: 12 },
  quarryHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  quarryAvatar: { width: 40, height: 40, borderRadius: 10, backgroundColor: Colors.primarySurface, alignItems: 'center', justifyContent: 'center' },
  quarryName: { fontSize: 15, fontWeight: '700', color: Colors.text },
  quarryOwner: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  quarryLoc: { fontSize: 11, color: Colors.textTertiary, marginTop: 2 },
  statusBadge: { backgroundColor: Colors.successLight, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  statusBadgeText: { fontSize: 10, fontWeight: '700', color: Colors.success },
  manageBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 8, borderRadius: 8, backgroundColor: Colors.primarySurface, borderWidth: 1, borderColor: Colors.primaryBorder },
  manageBtnText: { fontSize: 13, fontWeight: '700', color: Colors.primary },
  driverCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Colors.surface, padding: 12, borderRadius: 10, marginBottom: 8, borderWidth: 1, borderColor: Colors.borderLight },
  driverName: { fontSize: 14, fontWeight: '600', color: Colors.text },
  driverSub: { fontSize: 12, color: Colors.textSecondary },
  driverStatus: { fontSize: 11, fontWeight: '700', color: Colors.info },
  emptyCard: { padding: 32, alignItems: 'center', backgroundColor: Colors.surface, borderRadius: 12, borderWidth: 1, borderColor: Colors.borderLight },
  emptyText: { fontSize: 13, color: Colors.textSecondary, marginTop: 8 },
  pinRoot: { flex: 1, backgroundColor: Colors.background, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20 },
  pinCard: { width: '100%', maxWidth: 400, backgroundColor: Colors.surface, borderRadius: 16, padding: 24, borderWidth: 1, borderColor: Colors.borderLight, shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 10, elevation: 4 },
  pinIconWrap: { width: 64, height: 64, borderRadius: 16, backgroundColor: '#FFF3E0', alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: 16 },
  pinTitle: { fontSize: 22, fontWeight: '800', color: Colors.navy, textAlign: 'center' },
  pinSub: { fontSize: 13, color: Colors.textSecondary, textAlign: 'center', marginTop: 4, marginBottom: 20 },
  fieldGroup: { gap: 4 },
  label: { fontSize: 12, fontWeight: '600', color: Colors.text },
  inputWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.background, borderWidth: 1.5, borderColor: Colors.border, borderRadius: 10, overflow: 'hidden' },
  pinInput: { flex: 1, height: 48, paddingHorizontal: 12, fontSize: 15, color: Colors.text },
  errorBox: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.dangerLight, borderRadius: 8, padding: 8, marginTop: 10 },
  errorText: { fontSize: 12, color: Colors.danger },
  btnPrimary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 48, borderRadius: 10, marginTop: 14 },
  btnText: { fontSize: 15, fontWeight: '700', color: '#FFF' },
  pinHint: { fontSize: 12, color: Colors.textTertiary, textAlign: 'center', marginTop: 16 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContainer: { width: '100%', maxWidth: 500, backgroundColor: Colors.surface, borderRadius: 16, padding: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, borderBottomWidth: 1, borderBottomColor: Colors.borderLight, paddingBottom: 12 },
  modalTitle: { fontSize: 17, fontWeight: '700', color: Colors.navy },
  formGroup: { marginBottom: 12 },
  formLabel: { fontSize: 12, fontWeight: '600', color: Colors.text, marginBottom: 4 },
  formInput: { height: 44, borderWidth: 1, borderColor: Colors.border, borderRadius: 8, paddingHorizontal: 12, fontSize: 14, color: Colors.text, backgroundColor: Colors.background },
  modalFooter: { flexDirection: 'row', gap: 10, marginTop: 16, paddingTop: 12, borderTopWidth: 1, borderTopColor: Colors.borderLight },
  cancelBtn: { flex: 1, height: 44, borderRadius: 8, borderWidth: 1, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center' },
  cancelText: { fontSize: 14, fontWeight: '600', color: Colors.textSecondary },
  saveBtn: { flex: 1, height: 44, borderRadius: 8, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  saveText: { fontSize: 14, fontWeight: '700', color: '#FFF' },
});

