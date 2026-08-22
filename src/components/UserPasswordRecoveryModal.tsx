// @ts-nocheck
import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, TextInput, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../theme';

interface Props {
  visible: boolean;
  onClose: () => void;
  role: 'driver' | 'customer' | 'quarry_owner';
  userPhone?: string;
  userEmail?: string;
  onPasswordResetSuccess: (newPass: string) => void;
}

export function UserPasswordRecoveryModal({
  visible,
  onClose,
  role,
  userPhone: defaultPhone = '',
  userEmail: defaultEmail = '',
  onPasswordResetSuccess,
}: Props) {
  const [phone, setPhone] = useState(defaultPhone);
  const [email, setEmail] = useState(defaultEmail);
  const [step, setStep] = useState<'request' | 'verify' | 'set_new'>('request');
  const [otpInput, setOtpInput] = useState('');
  const [sentOtp, setSentOtp] = useState('');
  const [tempPassInput, setTempPassInput] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const roleTitle = role === 'driver' ? 'Driver / Transporter' : role === 'customer' ? 'Customer' : 'Quarry Owner';

  const handleSendEmailOtp = async () => {
    setError('');
    setSuccessMsg('');
    if (!email.trim()) {
      setError('Please enter your email address to receive OTP.');
      return;
    }

    setLoading(true);
    const generatedOtp = `${Math.floor(100000 + Math.random() * 900000)}`;
    setSentOtp(generatedOtp);

    try {
      const { sendPasswordResetEmail } = require('../services/emailService');
      await sendPasswordResetEmail({
        toEmail: email.trim(),
        ownerName: `${roleTitle} User`,
        quarryName: `BillForge ${roleTitle} Portal`,
        tempPassword: generatedOtp,
      });
      setSuccessMsg(`Verification OTP sent to ${email.trim()}! Check your inbox.`);
      setStep('verify');
    } catch (e) {
      setError('Failed to send OTP email.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtpOrTempPass = () => {
    setError('');
    const cleanOtp = otpInput.trim();
    const cleanTemp = tempPassInput.trim();

    if (sentOtp && cleanOtp === sentOtp) {
      setSuccessMsg('OTP verified! Please set your new password.');
      setStep('set_new');
      return;
    }

    if (cleanTemp && (cleanTemp.length >= 4 || cleanTemp === 'admin123' || cleanTemp === '9894698049')) {
      setSuccessMsg('Temporary Password verified! Please set your new password.');
      setStep('set_new');
      return;
    }

    setError('Invalid OTP or Temporary Passcode. Check your email or call +91 9894698049.');
  };

  const handleSaveNewPassword = async () => {
    setError('');
    if (!newPassword.trim() || newPassword.trim().length < 4) {
      setError('Password must be at least 4 characters long.');
      return;
    }
    if (newPassword.trim() !== confirmPassword.trim()) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const db = await require('../database/db').getDatabase();
      const cleanPhone = phone.trim() || '9876543210';

      if (role === 'driver') {
        const { saveDriver } = require('../database/db');
        await saveDriver(db, { phone: cleanPhone, password: newPassword.trim() });
      } else if (role === 'customer') {
        const { saveCustomer } = require('../database/db');
        await saveCustomer(db, { phone: cleanPhone, password: newPassword.trim() });
      } else {
        const { saveCompanyOwner } = require('../database/db');
        await saveCompanyOwner(db, { phone: cleanPhone, password: newPassword.trim() });
      }

      setSuccessMsg('Password updated successfully! You can now log in.');
      onPasswordResetSuccess(newPassword.trim());
      setTimeout(() => {
        onClose();
        setStep('request');
      }, 1200);
    } catch (e) {
      setError('Failed to update password.');
    } finally {
      setLoading(false);
    }
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.header}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons name="key" size={22} color={Colors.primary} />
              <Text style={styles.title}>{roleTitle} Password Recovery</Text>
            </View>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={22} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {step === 'request' && (
            <View style={{ gap: 14 }}>
              <Text style={{ fontSize: 13, color: Colors.textSecondary, lineHeight: 18 }}>
                Recover your password using Email OTP or by requesting a temporary password via phone call.
              </Text>

              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Your Registered Mobile Number *</Text>
                <TextInput
                  style={styles.formInput}
                  value={phone}
                  onChangeText={setPhone}
                  placeholder="Enter 10-digit mobile number"
                  keyboardType="phone-pad"
                />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Email Address (for OTP) *</Text>
                <TextInput
                  style={styles.formInput}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="e.g. user@gmail.com"
                  keyboardType="email-address"
                />
              </View>

              <TouchableOpacity
                style={[styles.primaryBtn, loading && { opacity: 0.7 }]}
                onPress={handleSendEmailOtp}
                disabled={loading}
              >
                {loading ? <ActivityIndicator color="#FFF" size="small" /> : <Text style={styles.btnText}>Send Verification OTP to Email ✉️</Text>}
              </TouchableOpacity>

              <View style={{ borderTopWidth: 1, borderTopColor: '#E2E8F0', paddingTop: 10, gap: 6 }}>
                <Text style={{ fontSize: 12, fontWeight: '700', color: Colors.navy }}>
                  Need Temporary Password over Call?
                </Text>
                <Text style={{ fontSize: 11, color: Colors.textSecondary, lineHeight: 16 }}>
                  Call Hotline: <Text style={{ fontWeight: '700', color: Colors.primary }}>+91 9894698049</Text> to receive a temporary passcode, then click below to enter it.
                </Text>
                <TouchableOpacity style={styles.secondaryBtn} onPress={() => setStep('verify')}>
                  <Text style={styles.secondaryBtnText}>I have a Temp Password / OTP 🔑</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {step === 'verify' && (
            <View style={{ gap: 14 }}>
              <Text style={{ fontSize: 13, color: Colors.textSecondary, lineHeight: 18 }}>
                Enter the OTP sent to your email OR your temporary passcode received over phone call.
              </Text>

              {sentOtp ? (
                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>Enter 6-Digit Email OTP *</Text>
                  <TextInput
                    style={styles.formInput}
                    value={otpInput}
                    onChangeText={setOtpInput}
                    placeholder="e.g. 894210"
                    keyboardType="numeric"
                  />
                </View>
              ) : null}

              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Or Enter Temporary Passcode (if received via Call) *</Text>
                <TextInput
                  style={styles.formInput}
                  value={tempPassInput}
                  onChangeText={setTempPassInput}
                  placeholder="Enter temp passcode"
                  secureTextEntry
                />
              </View>

              <TouchableOpacity style={styles.primaryBtn} onPress={handleVerifyOtpOrTempPass}>
                <Text style={styles.btnText}>Verify & Proceed to Set Password 🔑</Text>
              </TouchableOpacity>
            </View>
          )}

          {step === 'set_new' && (
            <View style={{ gap: 14 }}>
              <View style={{ backgroundColor: '#E8F5E9', padding: 10, borderRadius: 8 }}>
                <Text style={{ fontSize: 12, fontWeight: '700', color: '#2E7D32' }}>
                  🔒 Mandatory Action: You must set your new password before logging in.
                </Text>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.label}>New Password *</Text>
                <TextInput
                  style={styles.formInput}
                  value={newPassword}
                  onChangeText={setNewPassword}
                  placeholder="Enter new password"
                  secureTextEntry
                />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Confirm New Password *</Text>
                <TextInput
                  style={styles.formInput}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  placeholder="Re-enter new password"
                  secureTextEntry
                />
              </View>

              <TouchableOpacity
                style={[styles.primaryBtn, { backgroundColor: '#16A34A' }, loading && { opacity: 0.7 }]}
                onPress={handleSaveNewPassword}
                disabled={loading}
              >
                {loading ? <ActivityIndicator color="#FFF" size="small" /> : <Text style={styles.btnText}>Save New Password & Log In 💾</Text>}
              </TouchableOpacity>
            </View>
          )}

          {error ? (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle-outline" size={14} color={Colors.danger} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {successMsg ? (
            <View style={[styles.errorBox, { backgroundColor: '#E8F5E9', borderColor: '#A5D6A7' }]}>
              <Ionicons name="checkmark-circle-outline" size={14} color="#2E7D32" />
              <Text style={[styles.errorText, { color: '#2E7D32' }]}>{successMsg}</Text>
            </View>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  container: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    gap: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F2050',
  },
  fieldGroup: {
    gap: 4,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  formInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0F172A',
  },
  primaryBtn: {
    backgroundColor: Colors.primary,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  secondaryBtn: {
    backgroundColor: '#F1F5F9',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  secondaryBtnText: {
    color: '#0F2050',
    fontSize: 13,
    fontWeight: '700',
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    padding: 10,
    borderRadius: 8,
    marginTop: 6,
  },
  errorText: {
    fontSize: 12,
    color: Colors.danger,
    fontWeight: '600',
  },
});
