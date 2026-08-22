// @ts-nocheck
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../src/theme';
import { useAuth } from '../src/context/AuthContext';
import { getDatabase, authenticateOwner, requestPasswordResetOTP, verifyOTPAndResetPassword, verifyTempPasswordAndSetNew } from '../src/database/db';

const { width: W } = Dimensions.get('window');

export default function OwnerLoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { loginOwner } = useAuth();

  const [phone, setPhone] = useState('9894698049');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Password Recovery Modal State
  const [forgotModalVisible, setForgotModalVisible] = useState(false);
  const [recoveryMethod, setRecoveryMethod] = useState('otp'); // 'otp' or 'admin_temp'
  const [resetStep, setResetStep] = useState(1);
  const [resetPhone, setResetPhone] = useState('9894698049');
  const [otpCode, setOtpCode] = useState('');
  const [adminTempPass, setAdminTempPass] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError] = useState('');
  const [resetSuccessMsg, setResetSuccessMsg] = useState('');
  const [demoOTP, setDemoOTP] = useState('');

  const handleRequestOTP = async () => {
    setResetError('');
    if (!resetPhone.trim() || resetPhone.trim().length < 10) {
      setResetError('Please enter your registered 10-digit mobile number.');
      return;
    }
    setResetLoading(true);
    try {
      const db = await getDatabase();
      const res = await requestPasswordResetOTP(db, 'quarry_owner', resetPhone.trim());
      setDemoOTP(res.otpDemo);
      setResetSuccessMsg(`Verification OTP sent! (Demo Code: ${res.otpDemo})`);
      setResetStep(2);
    } catch (e) {
      setResetError(e.message || 'Account not found.');
    } finally {
      setResetLoading(false);
    }
  };

  const handleResetPassword = async () => {
    setResetError('');
    if (recoveryMethod === 'admin_temp') {
      if (!adminTempPass.trim()) { setResetError('Please enter the Temporary Password given by Admin.'); return; }
      if (!newPassword.trim() || newPassword.trim().length < 4) { setResetError('New password must be at least 4 characters long.'); return; }
      setResetLoading(true);
      try {
        const db = await getDatabase();
        await verifyTempPasswordAndSetNew(db, 'quarry_owner', resetPhone.trim(), adminTempPass.trim(), newPassword.trim());
        const authenticated = await authenticateOwner(db, resetPhone.trim(), newPassword.trim());
        if (authenticated && !authenticated.error) {
          loginOwner(authenticated);
          setForgotModalVisible(false);
          router.replace('/(tabs)');
        } else {
          setForgotModalVisible(false);
          setPassword(newPassword.trim());
          setPhone(resetPhone.trim());
          setError('Password set successfully! Tap Sign In.');
        }
      } catch (e) {
        setResetError(e.message || 'Failed to verify temp password.');
      } finally {
        setResetLoading(false);
      }
      return;
    }

    if (!otpCode.trim()) { setResetError('Please enter the 6-digit OTP code.'); return; }
    if (!newPassword.trim() || newPassword.trim().length < 4) { setResetError('New password must be at least 4 characters long.'); return; }

    setResetLoading(true);
    try {
      const db = await getDatabase();
      await verifyOTPAndResetPassword(db, 'quarry_owner', resetPhone.trim(), otpCode.trim(), newPassword.trim());
      
      const authenticated = await authenticateOwner(db, resetPhone.trim(), newPassword.trim());
      if (authenticated && !authenticated.error) {
        loginOwner(authenticated);
        setForgotModalVisible(false);
        router.replace('/(tabs)');
      } else {
        setForgotModalVisible(false);
        setPassword(newPassword.trim());
        setPhone(resetPhone.trim());
        setError('Password updated successfully! Tap Sign In.');
      }
    } catch (e) {
      setResetError(e.message || 'Failed to reset password.');
    } finally {
      setResetLoading(false);
    }
  };



  const handleLogin = async () => {
    setError('');
    if (!phone.trim()) { setError('Please enter your mobile number.'); return; }
    if (!password.trim()) { setError('Please enter your password.'); return; }

    setLoading(true);
    try {
      const db = await getDatabase();
      const authenticated = await authenticateOwner(db, phone, password);

      if (authenticated) {
        if (authenticated.error) {
          setError(authenticated.message);
          return;
        }
        const ownerUser = {
          id: authenticated.id,
          quarry_id: authenticated.id,
          name: authenticated.name || 'Sri Murugan Quarry',
          phone: authenticated.phone || phone.trim(),
          location: authenticated.location || 'Tiruppur',
          address: authenticated.address || 'Main Quarry Road',
          role: 'quarry_owner',
        };
        loginOwner(ownerUser);
        router.replace('/(tabs)');
      } else {
        setError('Invalid mobile number or password. Please try again or register.');
      }
    } catch (e) {
      console.error('Login error:', e);
      setError('Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 24 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Back */}
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={Colors.text} />
        </TouchableOpacity>

        {/* Icon + Title */}
        <View style={[styles.iconWrap, { backgroundColor: Colors.primarySurface, borderColor: Colors.primaryBorder }]}>
          <Ionicons name="business" size={34} color={Colors.primary} />
        </View>

        <Text style={styles.title}>Quarry Owner Login</Text>
        <Text style={styles.subtitle}>
          Sign in to access your company bills, auto-resume drafts, customer ledgers & transport handling
        </Text>

        {/* Form */}
        <View style={styles.form}>
          {/* Phone */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Mobile Number</Text>
            <View style={styles.inputWrap}>
              <Ionicons name="call-outline" size={18} color={Colors.textTertiary} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                value={phone}
                onChangeText={setPhone}
                placeholder="9999999999"
                placeholderTextColor={Colors.textDisabled}
                keyboardType="phone-pad"
                maxLength={10}
                returnKeyType="next"
              />
            </View>
          </View>

          {/* Password Header + Forgot Password Link */}
          <View style={styles.fieldGroup}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <Text style={styles.label}>Password</Text>
              <TouchableOpacity onPress={() => { setResetPhone(phone || '9894698049'); setResetStep(1); setResetError(''); setForgotModalVisible(true); }}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: Colors.primary }}>Forgot Password?</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.inputWrap}>
              <Ionicons name="lock-closed-outline" size={18} color={Colors.textTertiary} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { paddingRight: 48 }]}
                value={password}
                onChangeText={setPassword}
                placeholder="Enter password"
                placeholderTextColor={Colors.textDisabled}
                secureTextEntry={!showPass}
                returnKeyType="done"
                onSubmitEditing={handleLogin}
              />
              <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowPass(!showPass)}>
                <Ionicons name={showPass ? 'eye-off-outline' : 'eye-outline'} size={18} color={Colors.textTertiary} />
              </TouchableOpacity>
            </View>
          </View>


          {/* Error */}
          {error ? (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle-outline" size={14} color={Colors.danger} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {/* Login Button */}
          <TouchableOpacity
            style={[styles.loginBtn, loading && styles.loginBtnDisabled]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.82}
          >
            {loading
              ? <ActivityIndicator color="#FFF" size="small" />
              : (
                <>
                  <Text style={styles.loginBtnText}>Sign In as Quarry Owner</Text>
                  <Ionicons name="arrow-forward" size={18} color="#FFF" />
                </>
              )
            }
          </TouchableOpacity>

          {/* Register Link */}
          <TouchableOpacity
            style={styles.registerLinkBtn}
            onPress={() => router.push('/owner-register')}
            activeOpacity={0.8}
          >
            <Ionicons name="person-add-outline" size={18} color={Colors.primary} />
            <Text style={styles.registerLinkText}>New Business? Register Quarry Account</Text>
          </TouchableOpacity>
        </View>

        {/* Demo hint */}
        <View style={styles.demoBox}>
          <Ionicons name="information-circle-outline" size={14} color={Colors.info} />
          <Text style={styles.demoText}>
            Demo — Phone: <Text style={styles.demoBold}>9894698049</Text>  Password: <Text style={styles.demoBold}>owner123</Text>
          </Text>
        </View>
      </ScrollView>

      {/* Forgot Password OTP Modal */}
      {forgotModalVisible && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="key-outline" size={20} color={Colors.primary} />
                <Text style={styles.modalTitle}>Password Recovery</Text>
              </View>
              <TouchableOpacity onPress={() => setForgotModalVisible(false)}>
                <Ionicons name="close" size={22} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Recovery Method Tabs */}
            <View style={{ flexDirection: 'row', backgroundColor: Colors.background, borderRadius: 10, padding: 3, marginBottom: 16 }}>
              <TouchableOpacity
                style={[{ flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center' }, recoveryMethod === 'otp' && { backgroundColor: Colors.surface, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 2, elevation: 1 }]}
                onPress={() => { setRecoveryMethod('otp'); setResetStep(1); setResetError(''); }}
              >
                <Text style={{ fontSize: 12, fontWeight: '700', color: recoveryMethod === 'otp' ? Colors.primary : Colors.textSecondary }}>📩 Email / SMS OTP</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[{ flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center' }, recoveryMethod === 'admin_temp' && { backgroundColor: Colors.surface, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 2, elevation: 1 }]}
                onPress={() => { setRecoveryMethod('admin_temp'); setResetError(''); }}
              >
                <Text style={{ fontSize: 12, fontWeight: '700', color: recoveryMethod === 'admin_temp' ? Colors.primary : Colors.textSecondary }}>📞 Admin Temp Pass</Text>
              </TouchableOpacity>
            </View>

            {recoveryMethod === 'admin_temp' ? (
              <View style={{ gap: 14 }}>
                <Text style={{ fontSize: 13, color: Colors.textSecondary }}>
                  If you received a Temporary Password from Admin over phone call, enter it below to set your new permanent password:
                </Text>

                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>Mobile Number *</Text>
                  <View style={styles.inputWrap}>
                    <Ionicons name="call-outline" size={18} color={Colors.textTertiary} style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      value={resetPhone}
                      onChangeText={setResetPhone}
                      placeholder="10-digit mobile number"
                      keyboardType="phone-pad"
                      maxLength={10}
                    />
                  </View>
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>Admin Temporary Password *</Text>
                  <View style={styles.inputWrap}>
                    <Ionicons name="key-outline" size={18} color={Colors.textTertiary} style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      value={adminTempPass}
                      onChangeText={setAdminTempPass}
                      placeholder="e.g. temp1234 (given by admin)"
                    />
                  </View>
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>Set New Permanent Password *</Text>
                  <View style={styles.inputWrap}>
                    <Ionicons name="lock-closed-outline" size={18} color={Colors.textTertiary} style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      value={newPassword}
                      onChangeText={setNewPassword}
                      placeholder="Enter your new password (min 4 chars)"
                      secureTextEntry
                    />
                  </View>
                </View>

                {resetError ? (
                  <View style={styles.errorBox}>
                    <Ionicons name="alert-circle-outline" size={14} color={Colors.danger} />
                    <Text style={styles.errorText}>{resetError}</Text>
                  </View>
                ) : null}

                <TouchableOpacity
                  style={[styles.loginBtn, resetLoading && styles.loginBtnDisabled]}
                  onPress={handleResetPassword}
                  disabled={resetLoading}
                >
                  {resetLoading ? <ActivityIndicator color="#FFF" size="small" /> : <Text style={styles.loginBtnText}>Save New Password & Sign In 🔐</Text>}
                </TouchableOpacity>
              </View>
            ) : resetStep === 1 ? (
              <View style={{ gap: 14 }}>
                <Text style={{ fontSize: 13, color: Colors.textSecondary }}>
                  Enter your registered mobile number to receive a 6-digit verification OTP code:
                </Text>

                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>Mobile Number *</Text>
                  <View style={styles.inputWrap}>
                    <Ionicons name="call-outline" size={18} color={Colors.textTertiary} style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      value={resetPhone}
                      onChangeText={setResetPhone}
                      placeholder="10-digit mobile number"
                      keyboardType="phone-pad"
                      maxLength={10}
                    />
                  </View>
                </View>

                {resetError ? (
                  <View style={styles.errorBox}>
                    <Ionicons name="alert-circle-outline" size={14} color={Colors.danger} />
                    <Text style={styles.errorText}>{resetError}</Text>
                  </View>
                ) : null}

                <TouchableOpacity
                  style={[styles.loginBtn, resetLoading && styles.loginBtnDisabled]}
                  onPress={handleRequestOTP}
                  disabled={resetLoading}
                >
                  {resetLoading ? <ActivityIndicator color="#FFF" size="small" /> : <Text style={styles.loginBtnText}>Send Verification OTP 📩</Text>}
                </TouchableOpacity>
              </View>
            ) : (
              <View style={{ gap: 14 }}>
                <View style={[styles.demoBox, { marginTop: 0, backgroundColor: '#E8F5E9', borderColor: '#A5D6A7' }]}>
                  <Ionicons name="checkmark-circle-outline" size={16} color="#2E7D32" />
                  <Text style={[styles.demoText, { color: '#2E7D32' }]}>
                    {resetSuccessMsg}
                  </Text>
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>Enter 6-Digit OTP Code *</Text>
                  <View style={styles.inputWrap}>
                    <Ionicons name="shield-checkmark-outline" size={18} color={Colors.textTertiary} style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      value={otpCode}
                      onChangeText={setOtpCode}
                      placeholder={`Enter OTP (Demo: ${demoOTP || '849201'})`}
                      keyboardType="numeric"
                      maxLength={6}
                    />
                  </View>
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>New Password *</Text>
                  <View style={styles.inputWrap}>
                    <Ionicons name="lock-closed-outline" size={18} color={Colors.textTertiary} style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      value={newPassword}
                      onChangeText={setNewPassword}
                      placeholder="Enter new password (min 4 chars)"
                      secureTextEntry
                    />
                  </View>
                </View>

                {resetError ? (
                  <View style={styles.errorBox}>
                    <Ionicons name="alert-circle-outline" size={14} color={Colors.danger} />
                    <Text style={styles.errorText}>{resetError}</Text>
                  </View>
                ) : null}

                <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
                  <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setResetStep(1)}>
                    <Text style={styles.modalCancelText}>Back</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.loginBtn, { flex: 2, marginTop: 0 }, resetLoading && styles.loginBtnDisabled]}
                    onPress={handleResetPassword}
                    disabled={resetLoading}
                  >
                    {resetLoading ? <ActivityIndicator color="#FFF" size="small" /> : <Text style={styles.loginBtnText}>Reset & Sign In 🔐</Text>}
                  </TouchableOpacity>
                </View>
              </View>
            )}

          </View>
        </View>
      )}
    </KeyboardAvoidingView>

  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  scroll: { paddingHorizontal: 24 },
  backBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: Colors.surface,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.border,
    marginBottom: 28,
  },
  iconWrap: {
    width: 72, height: 72, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
    alignSelf: 'center',
    borderWidth: 1,
    marginBottom: 20,
  },
  title: { fontSize: 24, fontWeight: '800', color: Colors.navy, textAlign: 'center', letterSpacing: -0.4 },
  subtitle: { fontSize: 13, color: Colors.textSecondary, textAlign: 'center', marginTop: 6, lineHeight: 19, marginBottom: 32 },
  form: { gap: 16 },
  fieldGroup: { gap: 6 },
  label: { fontSize: 13, fontWeight: '600', color: Colors.text },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.surface,
    borderWidth: 1.5, borderColor: Colors.border,
    borderRadius: 12, overflow: 'hidden',
  },
  inputIcon: { paddingLeft: 14 },
  input: {
    flex: 1, height: 52,
    paddingHorizontal: 12,
    fontSize: 15,
    color: Colors.text,
  },
  eyeBtn: { padding: 14, position: 'absolute', right: 0 },
  errorBox: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.dangerLight,
    borderRadius: 10, padding: 10,
    borderWidth: 1, borderColor: Colors.dangerBorder,
  },
  errorText: { fontSize: 12, color: Colors.danger, flex: 1 },
  loginBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, height: 56, borderRadius: 14,
    backgroundColor: Colors.primary,
    marginTop: 8,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  loginBtnDisabled: { opacity: 0.7 },
  registerLinkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justify: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 48,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.primaryBorder,
    backgroundColor: Colors.primarySurface,
    marginTop: 6,
  },
  registerLinkText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.primary,
  },
  demoBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 6,
    backgroundColor: Colors.infoLight,
    borderRadius: 10, padding: 12, marginTop: 28,
    borderWidth: 1, borderColor: Colors.infoBorder,
  },
  demoText: { fontSize: 12, color: Colors.info, flex: 1, lineHeight: 18 },
  demoBold: { fontWeight: '700' },
  modalOverlay: {
    position: 'absolute', top: 0, bottom: 0, left: 0, right: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center', alignItems: 'center',
    padding: 20, zIndex: 999,
  },
  modalCard: {
    width: '100%', maxWidth: 440,
    backgroundColor: Colors.surface,
    borderRadius: 16, padding: 22,
    borderWidth: 1, borderColor: Colors.borderLight,
    shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15, shadowRadius: 12, elevation: 6,
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 16, borderBottomWidth: 1, borderBottomColor: Colors.borderLight,
    paddingBottom: 12,
  },
  modalTitle: { fontSize: 17, fontWeight: '800', color: Colors.navy },
  modalCancelBtn: {
    flex: 1, height: 48, borderRadius: 12,
    borderWidth: 1.5, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  modalCancelText: { fontSize: 14, fontWeight: '700', color: Colors.textSecondary },
});

