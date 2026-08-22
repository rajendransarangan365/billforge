// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, TextInput, ActivityIndicator, Alert, Switch } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../theme';
import { getDatabase, updateUserProfile } from '../database/db';

interface Props {
  visible: boolean;
  onClose: () => void;
  role: 'driver' | 'customer' | 'quarry_owner';
  userProfile: any;
  onProfileUpdated: (updatedUser: any) => void;
}

export function ProfileSettingsModal({ visible, onClose, role, userProfile, onProfileUpdated }: Props) {
  const [email, setEmail] = useState('');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible && userProfile) {
      setEmail(userProfile.email || '');
      setLat(userProfile.lat ? String(userProfile.lat) : '');
      setLng(userProfile.lng ? String(userProfile.lng) : '');
      setIsActive(userProfile.status !== 'Inactive');
    }
  }, [visible, userProfile]);

  const handleSave = async () => {
    setLoading(true);
    try {
      const db = await getDatabase();
      const updates: any = { email };
      if (lat) updates.lat = parseFloat(lat);
      if (lng) updates.lng = parseFloat(lng);
      
      if (role === 'driver') {
        updates.status = isActive ? 'Available' : 'Inactive';
      }

      const updated = await updateUserProfile(db, role, userProfile.id, updates);
      if (updated) {
        onProfileUpdated(updated);
        onClose();
      } else {
        Alert.alert('Error', 'Failed to update profile.');
      }
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
    }
  };

  const getGeoLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLat(String(position.coords.latitude));
          setLng(String(position.coords.longitude));
        },
        (error) => {
          Alert.alert('Error', 'Unable to get location: ' + error.message);
        }
      );
    } else {
      Alert.alert('Error', 'Geolocation is not supported by your browser.');
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.modalCard}>
          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <Ionicons name="close" size={24} color={Colors.textSecondary} />
          </TouchableOpacity>
          <View style={styles.iconWrap}>
            <Ionicons name="person-circle" size={32} color={Colors.primary} />
          </View>
          <Text style={styles.title}>Profile Settings</Text>

          <View style={styles.form}>
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Email Address</Text>
              <TextInput style={styles.input} value={email} onChangeText={setEmail} placeholder="Optional email for recovery" />
            </View>

            {role === 'driver' && (
              <View style={styles.switchRow}>
                <View>
                  <Text style={styles.label}>Active Tracking</Text>
                  <Text style={{ fontSize: 11, color: Colors.textSecondary }}>Share your live location with quarries</Text>
                </View>
                <Switch value={isActive} onValueChange={setIsActive} trackColor={{ true: Colors.primary }} />
              </View>
            )}

            {(role === 'quarry_owner' || role === 'customer') && (
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>{role === 'quarry_owner' ? 'Pickup Location (GPS)' : 'Drop Location (GPS)'}</Text>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <TextInput style={[styles.input, { flex: 1 }]} value={lat} onChangeText={setLat} placeholder="Lat" keyboardType="numeric" />
                  <TextInput style={[styles.input, { flex: 1 }]} value={lng} onChangeText={setLng} placeholder="Lng" keyboardType="numeric" />
                </View>
                <TouchableOpacity style={styles.geoBtn} onPress={getGeoLocation}>
                  <Ionicons name="location" size={16} color={Colors.primary} />
                  <Text style={styles.geoBtnText}>Get Current Location</Text>
                </TouchableOpacity>
              </View>
            )}

            <TouchableOpacity style={styles.btnPrimary} onPress={handleSave} disabled={loading}>
              {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.btnPrimaryText}>Save Settings</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  modalCard: { backgroundColor: '#FFF', borderRadius: 16, padding: 24, maxWidth: 400, width: '100%', alignSelf: 'center', elevation: 10 },
  closeBtn: { position: 'absolute', top: 16, right: 16, zIndex: 10 },
  iconWrap: { width: 64, height: 64, borderRadius: 32, backgroundColor: Colors.primarySurface, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: 16 },
  title: { fontSize: 20, fontWeight: '800', color: Colors.navy, textAlign: 'center', marginBottom: 24 },
  form: { gap: 16 },
  fieldGroup: { gap: 6 },
  label: { fontSize: 13, fontWeight: '600', color: Colors.text },
  input: { height: 48, borderWidth: 1, borderColor: Colors.border, borderRadius: 8, paddingHorizontal: 12, backgroundColor: '#FAFAFA' },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#FAFAFA', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: Colors.border },
  btnPrimary: { height: 48, backgroundColor: Colors.primary, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginTop: 12 },
  btnPrimaryText: { color: '#FFF', fontSize: 15, fontWeight: '700' },
  geoBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  geoBtnText: { color: Colors.primary, fontSize: 13, fontWeight: '600' },
});
