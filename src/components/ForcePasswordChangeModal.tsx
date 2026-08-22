// @ts-nocheck
import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, TextInput, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../theme';
import { getDatabase, verifyTempPasswordAndSetNew } from '../database/db';

interface Props {
  visible: boolean;
  role: 'driver' | 'customer' | 'quarry_owner';
  userPhone: string;
  onSuccess: (newPassword: string) => void;
}

export function ForcePasswordChangeModal({ visible, role, userPhone, onSuccess }: Props) {
  const [tempPass, setTempPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    setError('');
    if (!tempPass.trim()) { setError('Enter the temporary password provided by Admin.'); return; }
    if (!newPass.trim() || newPass.length < 4) { setError('New password must be at least 4 characters.'); return; }
    if (newPass !== confirmPass) { setError('New passwords do not match.'); return; }

    setLoading(true);
    try {
      const db = await getDatabase();
      await verifyTempPasswordAndSetNew(db, role, userPhone, tempPass, newPass);
      onSuccess(newPass);
    } catch (e: any) {
      setError(e.message || 'Failed to change password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.modalCard}>
          <View style={styles.iconWrap}>
            <Ionicons name="lock-closed" size={32} color="#E65100" />
          </View>
          <Text style={styles.title}>Mandatory Password Update</Text>
          <Text style={styles.subtitle}>
            You are logging in with a Temporary Password issued by the Admin. You must set a new personal password before proceeding.
          </Text>

          <View style={styles.form}>
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Temporary Password</Text>
              <TextInput
                style={styles.input}
                value={tempPass}
                onChangeText={setTempPass}
                placeholder="Enter Temp Password"
                secureTextEntry
              />
            </View>
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>New Password</Text>
              <TextInput
                style={styles.input}
                value={newPass}
                onChangeText={setNewPass}
                placeholder="Create New Password"
                secureTextEntry
              />
            </View>
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Confirm New Password</Text>
              <TextInput
                style={styles.input}
                value={confirmPass}
                onChangeText={setConfirmPass}
                placeholder="Confirm New Password"
                secureTextEntry
              />
            </View>

            {error ? (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle" size={16} color={Colors.danger} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <TouchableOpacity
              style={styles.btnPrimary}
              onPress={handleSubmit}
              disabled={loading}
            >
              {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.btnPrimaryText}>Update & Login</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  modalCard: { backgroundColor: '#FFF', borderRadius: 16, padding: 24, maxWidth: 400, width: '100%', alignSelf: 'center', elevation: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 10 },
  iconWrap: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#FFF3E0', alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: 16 },
  title: { fontSize: 20, fontWeight: '800', color: Colors.navy, textAlign: 'center', marginBottom: 8 },
  subtitle: { fontSize: 13, color: Colors.textSecondary, textAlign: 'center', marginBottom: 24, lineHeight: 20 },
  form: { gap: 16 },
  fieldGroup: { gap: 6 },
  label: { fontSize: 12, fontWeight: '600', color: Colors.text },
  input: { height: 48, borderWidth: 1, borderColor: Colors.border, borderRadius: 8, paddingHorizontal: 12, backgroundColor: '#FAFAFA' },
  btnPrimary: { height: 48, backgroundColor: Colors.primary, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  btnPrimaryText: { color: '#FFF', fontSize: 15, fontWeight: '700' },
  errorBox: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.dangerLight, padding: 10, borderRadius: 8 },
  errorText: { color: Colors.danger, fontSize: 12, flex: 1 },
});
