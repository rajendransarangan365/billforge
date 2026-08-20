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
import { getDatabase, authenticateOwner } from '../src/database/db';

const { width: W } = Dimensions.get('window');

export default function OwnerLoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { loginOwner } = useAuth();

  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async () => {
    setError('');
    if (!phone.trim()) { setError('Please enter your mobile number.'); return; }
    if (!password.trim()) { setError('Please enter your password.'); return; }

    setLoading(true);
    try {
      const db = await getDatabase();
      const authenticated = await authenticateOwner(db, phone, password);

      if (authenticated) {
        const ownerUser = {
          id: authenticated.id,
          quarry_id: authenticated.id,
          name: authenticated.name || 'Sri Murugan Quarry',
          phone: authenticated.phone || phone.trim(),
          location: authenticated.location || 'Tiruppur',
          address: authenticated.address || 'Main Quarry Road',
          role: 'owner',
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

          {/* Password */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Password</Text>
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
            Demo — Phone: <Text style={styles.demoBold}>9999999999</Text>  Password: <Text style={styles.demoBold}>admin123</Text>
          </Text>
        </View>
      </ScrollView>
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
});
