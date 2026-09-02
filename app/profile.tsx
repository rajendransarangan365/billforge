// @ts-nocheck
import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Switch, ActivityIndicator, Alert, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../src/theme';
import { useAuth } from '../src/context/AuthContext';
import { useToast } from '../src/context/ToastContext';
import { getDatabase, getQuarryDetails, saveQuarryDetails, saveCompanyProfile, saveDriver, saveCustomer } from '../src/database/db';
import { LeafletMapModal } from '../src/components/LeafletMapModal';

export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, role, quarryId, logout, updateUser } = useAuth();
  const { showToast } = useToast();

  const userRole = user?.role || role || 'quarry_owner';

  // Profile Form State
  const [name, setName] = useState(user?.name || user?.owner_name || '');
  const [phone, setPhone] = useState(user?.phone || '9876543210');
  const [email, setEmail] = useState(user?.email || '');
  const [companyName, setCompanyName] = useState(user?.company_name || user?.name || '');
  const [vehicleNo, setVehicleNo] = useState(user?.vehicle_no || 'TN 38 AB 1234');

  // Location Telemetry State
  const [locationName, setLocationName] = useState(user?.location || 'Tiruppur, Tamil Nadu');
  const [lat, setLat] = useState(user?.lat || 11.1085);
  const [lng, setLng] = useState(user?.lng || 77.3411);
  const [mapModalVisible, setMapModalVisible] = useState(false);

  // Driver Duty Status Toggle
  const [dutyActive, setDutyActive] = useState(user?.status !== 'Offline');
  const [gpsTracking, setGpsTracking] = useState(false);

  // Security Passcode State
  const [tempPasscode, setTempPasscode] = useState('temp8083');
  const [newPassword, setNewPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const db = await getDatabase();
      if (userRole === 'quarry_owner') {
        const q = await getQuarryDetails(db, quarryId || 1);
        if (q) {
          setName(q.name || q.owner_name || name);
          setCompanyName(q.company_name || q.name || companyName);
          setPhone(q.phone || phone);
          setEmail(q.email || email);
          setLocationName(q.location || locationName);
          if (q.lat) setLat(q.lat);
          if (q.lng) setLng(q.lng);
        }
      }
    } catch (e) {}
  };

  // Watch GPS Telemetry when Driver toggles Duty to Active
  useEffect(() => {
    let watchId;
    if (userRole === 'driver' && dutyActive && Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.geolocation) {
      setGpsTracking(true);
      watchId = navigator.geolocation.watchPosition(
        (pos) => {
          const currentLat = pos.coords.latitude;
          const currentLng = pos.coords.longitude;
          setLat(currentLat);
          setLng(currentLng);
          // Broadcast live driver GPS coordinates
          try {
            const { broadcastRealtimeEvent } = require('../src/services/realtimeService');
            broadcastRealtimeEvent('DRIVER_LOCATION_UPDATE', {
              driver_id: user?.id || phone,
              driver_name: name,
              vehicle_no: vehicleNo,
              lat: currentLat,
              lng: currentLng,
            });
          } catch (err) {}
        },
        (err) => {
          setGpsTracking(false);
        },
        { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 }
      );
    } else {
      setGpsTracking(false);
    }

    return () => {
      if (watchId && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, [dutyActive, userRole]);

  const handleSaveProfile = async () => {
    setSaving(true);
    setSuccessMsg('');
    try {
      const db = await getDatabase();
      const targetQid = quarryId || 1;
      const effectiveName = companyName || name || 'My Business';

      if (userRole === 'quarry_owner') {
        await saveCompanyProfile(db, {
          id: targetQid,
          name: effectiveName,
          owner_name: name,
          phone,
          email,
          address: locationName,
          location: locationName,
          lat,
          lng,
        });
      } else if (userRole === 'driver') {
        await saveDriver(db, {
          phone,
          name,
          vehicle_no: vehicleNo,
          status: dutyActive ? 'Available' : 'Offline',
          lat,
          lng,
        });
      } else if (userRole === 'customer') {
        await saveCustomer(db, {
          phone,
          name,
          company_name: companyName,
          email,
          location: locationName,
          lat,
          lng,
        });
      }

      updateUser({
        name,
        company_name: effectiveName,
        phone,
        email,
        location: locationName,
        lat,
        lng,
      });

      setSuccessMsg('Profile and settings updated successfully!');
      showToast('Profile and settings updated successfully & synced to server! ✨', 'success', 'Saved Successfully');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (e) {
      console.error('Profile save error:', e);
      showToast('Failed to save profile settings.', 'error', 'Save Error');
    } finally {
      setSaving(false);
    }
  };

  const handleCopyTempPasscode = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(tempPasscode);
      Alert.alert('Copied 🔑', `Temporary Passcode '${tempPasscode}' copied to clipboard.`);
    } else {
      Alert.alert('Passcode 🔑', `Temporary Passcode: ${tempPasscode}`);
    }
  };

  const roleTitle = userRole === 'quarry_owner' ? 'Quarry Owner & Yard Profile'
    : userRole === 'driver' ? 'Transporter & Driver Profile'
    : userRole === 'customer' ? 'Customer & Site Profile'
    : 'Platform Administrator';

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={20} color={Colors.navy} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.topTitle}>{roleTitle}</Text>
          <Text style={styles.topSub}>Manage email, geo-locations, security passcodes & duty preferences</Text>
        </View>
        <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
          <Ionicons name="log-out-outline" size={16} color={Colors.danger} />
          <Text style={{ fontSize: 12, fontWeight: '700', color: Colors.danger }}>Logout</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* User Card Header */}
        <View style={styles.profileCard}>
          <View style={styles.avatarWrap}>
            <Ionicons
              name={userRole === 'quarry_owner' ? 'business' : userRole === 'driver' ? 'car-sport' : userRole === 'customer' ? 'person' : 'shield-checkmark'}
              size={36}
              color="#FFF"
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.userName}>{name || 'BillForge Account'}</Text>
            <Text style={styles.userRole}>
              {userRole.toUpperCase()} • Mobile: {phone}
            </Text>
            <Text style={styles.userEmail}>{email || 'No email set (Click below to add email)'}</Text>
          </View>
        </View>

        {/* DRIVER DUTY STATUS TOGGLE SWITCH */}
        {userRole === 'driver' && (
          <View style={styles.dutyCard}>
            <View style={{ flex: 1, gap: 2 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <View style={[styles.statusDot, { backgroundColor: dutyActive ? '#22C55E' : '#94A3B8' }]} />
                <Text style={styles.dutyTitle}>
                  Driver Duty Status: {dutyActive ? 'ACTIVE 🟢 (Available)' : 'INACTIVE 🔴 (Offline)'}
                </Text>
              </View>
              <Text style={styles.dutySub}>
                {dutyActive
                  ? 'Live GPS Telemetry Active 🛰️. Transporters & Quarries can track your vehicle.'
                  : 'You are offline. Toggle to Active when ready to accept trips.'}
              </Text>
              {gpsTracking && (
                <Text style={{ fontSize: 11, fontWeight: '700', color: '#1565C0', marginTop: 4 }}>
                  📍 Broadcasting Live GPS: {lat.toFixed(4)}, {lng.toFixed(4)}
                </Text>
              )}
            </View>
            <Switch
              value={dutyActive}
              onValueChange={setDutyActive}
              trackColor={{ false: '#CBD5E1', true: '#86EFAC' }}
              thumbColor={dutyActive ? '#16A34A' : '#64748B'}
            />
          </View>
        )}

        {/* GENERAL CONTACT SETTINGS */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Basic Profile & Contact Settings</Text>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Full Name / Owner Name *</Text>
            <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Enter name" />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Mobile Number *</Text>
            <TextInput style={styles.input} value={phone} onChangeText={setPhone} placeholder="Enter mobile" keyboardType="phone-pad" />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Email Address (for Email Notifications & Invoices) *</Text>
            <TextInput style={styles.input} value={email} onChangeText={setEmail} placeholder="e.g. user@gmail.com" keyboardType="email-address" />
          </View>

          {userRole === 'driver' && (
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Vehicle Registration Number *</Text>
              <TextInput style={styles.input} value={vehicleNo} onChangeText={setVehicleNo} placeholder="e.g. TN 38 AB 1234" />
            </View>
          )}

          {(userRole === 'customer' || userRole === 'quarry_owner') && (
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Company / Business Name *</Text>
              <TextInput style={styles.input} value={companyName} onChangeText={setCompanyName} placeholder="Enter business name" />
            </View>
          )}
        </View>

        {/* GEO-LOCATION & SITE PICKUP / DROP SETTINGS */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>
            {userRole === 'quarry_owner' ? 'Quarry Yard Pickup Location 📍' : userRole === 'customer' ? 'Default Drop / Delivery Site Location 📍' : 'Home Base Location 📍'}
          </Text>

          <Text style={{ fontSize: 12, color: Colors.textSecondary, marginBottom: 8 }}>
            Pinpoint exact GPS coordinates so drivers and suppliers can navigate using Leaflet / Google Maps.
          </Text>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Address / Area Name *</Text>
            <TextInput style={styles.input} value={locationName} onChangeText={setLocationName} placeholder="City / Area / Gate details" />
          </View>

          <View style={{ flexDirection: 'row', gap: 12 }}>
            <View style={[styles.fieldGroup, { flex: 1 }]}>
              <Text style={styles.label}>Latitude</Text>
              <TextInput style={styles.input} value={String(lat)} onChangeText={(v) => setLat(parseFloat(v) || 0)} keyboardType="numeric" />
            </View>
            <View style={[styles.fieldGroup, { flex: 1 }]}>
              <Text style={styles.label}>Longitude</Text>
              <TextInput style={styles.input} value={String(lng)} onChangeText={(v) => setLng(parseFloat(v) || 0)} keyboardType="numeric" />
            </View>
          </View>

          <TouchableOpacity style={styles.mapPinBtn} onPress={() => setMapModalVisible(true)}>
            <Ionicons name="map-outline" size={18} color="#1565C0" />
            <Text style={styles.mapPinBtnText}>Open Leaflet Map & Detect GPS Location 🎯</Text>
          </TouchableOpacity>
        </View>

        {/* SECURITY & TEMP PASSCODE DISPLAY */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Security & Passcode Management 🔑</Text>

          <View style={styles.passcodeBox}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={{ fontSize: 12, fontWeight: '700', color: Colors.navy }}>Your Temporary Recovery Passcode</Text>
              <Text style={{ fontSize: 16, fontWeight: '900', color: Colors.primary, letterSpacing: 1 }}>{tempPasscode}</Text>
            </View>
            <TouchableOpacity style={styles.copyBtn} onPress={handleCopyTempPasscode}>
              <Ionicons name="copy-outline" size={14} color="#FFF" />
              <Text style={{ fontSize: 12, fontWeight: '700', color: '#FFF' }}>Copy Passcode</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* SAVE ACTION BUTTON */}
        {successMsg ? (
          <View style={styles.successBox}>
            <Ionicons name="checkmark-circle-outline" size={16} color="#2E7D32" />
            <Text style={{ fontSize: 13, fontWeight: '700', color: '#2E7D32' }}>{successMsg}</Text>
          </View>
        ) : null}

        <TouchableOpacity style={styles.saveBtn} onPress={handleSaveProfile} disabled={saving}>
          {saving ? <ActivityIndicator color="#FFF" size="small" /> : <Text style={styles.saveBtnText}>Save Profile Settings 💾</Text>}
        </TouchableOpacity>
      </ScrollView>

      {/* Map Geo-Pinning Modal */}
      <LeafletMapModal
        visible={mapModalVisible}
        onClose={() => setMapModalVisible(false)}
        initialLat={lat}
        initialLng={lng}
        title={userRole === 'quarry_owner' ? 'Mark Quarry Yard Location' : 'Mark Delivery Location'}
        onSelectLocation={(selectedLat, selectedLng, address) => {
          setLat(selectedLat);
          setLng(selectedLng);
          if (address) setLocationName(address);
        }}
      />
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
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },

  scroll: { padding: 16, maxWidth: 640, alignSelf: 'center', width: '100%', gap: 16 },

  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F2050',
    borderRadius: 14,
    padding: 16,
    gap: 14,
  },
  avatarWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userName: { fontSize: 18, fontWeight: '800', color: '#FFFFFF' },
  userRole: { fontSize: 12, fontWeight: '700', color: '#E2E8F0', marginTop: 2 },
  userEmail: { fontSize: 11, color: '#94A3B8', marginTop: 2 },

  dutyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: 12,
    padding: 14,
    gap: 12,
  },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  dutyTitle: { fontSize: 13, fontWeight: '800', color: '#166534' },
  dutySub: { fontSize: 11, color: '#15803D' },

  sectionCard: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  sectionTitle: { fontSize: 14, fontWeight: '800', color: Colors.navy },

  fieldGroup: { gap: 4 },
  label: { fontSize: 12, fontWeight: '700', color: Colors.textSecondary },
  input: {
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: Colors.text,
  },

  mapPinBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E3F2FD',
    borderWidth: 1,
    borderColor: '#90CAF9',
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
    marginTop: 4,
  },
  mapPinBtnText: { color: '#1565C0', fontSize: 13, fontWeight: '700' },

  passcodeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 10,
    padding: 12,
  },
  copyBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },

  successBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#E8F5E9',
    borderWidth: 1,
    borderColor: '#A5D6A7',
    padding: 12,
    borderRadius: 8,
  },

  saveBtn: {
    backgroundColor: Colors.primary,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnText: { color: '#FFF', fontSize: 15, fontWeight: '800' },
});
