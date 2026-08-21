// @ts-nocheck
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, KeyboardAvoidingView, Platform,
  TouchableOpacity, ScrollView, TextInput, ActivityIndicator, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../src/theme';
import { useAuth } from '../src/context/AuthContext';
import { getDatabase, registerCustomerAccount } from '../src/database/db';

export default function CustomerRegisterScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { loginCustomer } = useAuth();

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [address, setAddress] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleRegister = async () => {
    setError('');
    if (!name.trim()) { setError('Please enter your full name.'); return; }
    if (!phone.trim() || phone.trim().length < 10) { setError('Please enter a valid 10-digit mobile number.'); return; }
    if (!password.trim() || password.trim().length < 4) { setError('Password must be at least 4 characters.'); return; }

    setLoading(true);
    try {
      const db = await getDatabase();
      const newCustomer = await registerCustomerAccount(db, {
        name: name.trim(),
        phone: phone.trim(),
        password: password.trim(),
        address: address.trim(),
        company_name: companyName.trim() || name.trim(),
      });
      loginCustomer(newCustomer);
      router.replace('/customer-marketplace');
    } catch (e) {
      setError(e.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 24 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={Colors.text} />
        </TouchableOpacity>

        <View style={[styles.iconWrap, { backgroundColor: '#E8F5E9' }]}>
          <Ionicons name="person-add" size={34} color="#2E7D32" />
        </View>

        <Text style={styles.title}>Register Customer Account</Text>
        <Text style={styles.subtitle}>
          Create your buyer account to browse live quarry rates, submit material enquiries, and track orders
        </Text>

        <View style={styles.form}>
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Full Name / Contact Person *</Text>
            <View style={styles.inputWrap}>
              <Ionicons name="person-outline" size={18} color={Colors.textTertiary} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="e.g. Anand Kumar"
                placeholderTextColor={Colors.textDisabled}
                returnKeyType="next"
              />
            </View>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Mobile Number *</Text>
            <View style={styles.inputWrap}>
              <Ionicons name="call-outline" size={18} color={Colors.textTertiary} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                value={phone}
                onChangeText={setPhone}
                placeholder="10-digit mobile number"
                placeholderTextColor={Colors.textDisabled}
                keyboardType="phone-pad"
                maxLength={10}
                returnKeyType="next"
              />
            </View>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Password / PIN *</Text>
            <View style={styles.inputWrap}>
              <Ionicons name="lock-closed-outline" size={18} color={Colors.textTertiary} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                placeholder="Create a 4-digit PIN or password"
                placeholderTextColor={Colors.textDisabled}
                secureTextEntry
                returnKeyType="next"
              />
            </View>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Company / Construction Firm Name (Optional)</Text>
            <View style={styles.inputWrap}>
              <Ionicons name="business-outline" size={18} color={Colors.textTertiary} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                value={companyName}
                onChangeText={setCompanyName}
                placeholder="e.g. Kovai Builders & Developers"
                placeholderTextColor={Colors.textDisabled}
                returnKeyType="next"
              />
            </View>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Primary Delivery Site Address (Optional)</Text>
            <View style={styles.inputWrap}>
              <Ionicons name="location-outline" size={18} color={Colors.textTertiary} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                value={address}
                onChangeText={setAddress}
                placeholder="e.g. Site #42, Avinashi Road, Tiruppur"
                placeholderTextColor={Colors.textDisabled}
                returnKeyType="done"
                onSubmitEditing={handleRegister}
              />
            </View>
          </View>

          {error ? (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle-outline" size={14} color={Colors.danger} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <TouchableOpacity
            style={[styles.loginBtn, { backgroundColor: '#2E7D32' }, loading && styles.loginBtnDisabled]}
            onPress={handleRegister}
            disabled={loading}
            activeOpacity={0.82}
          >
            {loading
              ? <ActivityIndicator color="#FFF" size="small" />
              : (
                <>
                  <Text style={styles.loginBtnText}>Create Account & Browse Quarries</Text>
                  <Ionicons name="arrow-forward" size={18} color="#FFF" />
                </>
              )
            }
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.loginLink} onPress={() => router.push('/customer-login')}>
          <Text style={styles.loginLinkText}>Already registered? <Text style={{ fontWeight: '800', color: '#2E7D32' }}>Log in to Customer Portal</Text></Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  scroll: { paddingHorizontal: 24, maxWidth: 500, alignSelf: 'center', width: '100%' },
  backBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.border, marginBottom: 20,
  },
  iconWrap: {
    width: 72, height: 72, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
    alignSelf: 'center', marginBottom: 16,
  },
  title: { fontSize: 24, fontWeight: '800', color: Colors.navy, textAlign: 'center', letterSpacing: -0.4 },
  subtitle: { fontSize: 13, color: Colors.textSecondary, textAlign: 'center', marginTop: 6, lineHeight: 19, marginBottom: 24 },
  form: { gap: 14 },
  fieldGroup: { gap: 6 },
  label: { fontSize: 13, fontWeight: '600', color: Colors.text },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.surface, borderWidth: 1.5, borderColor: Colors.border,
    borderRadius: 12, overflow: 'hidden',
  },
  inputIcon: { paddingLeft: 14 },
  input: { flex: 1, height: 50, paddingHorizontal: 12, fontSize: 15, color: Colors.text },
  errorBox: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.dangerLight, borderRadius: 10, padding: 10,
    borderWidth: 1, borderColor: Colors.dangerBorder,
  },
  errorText: { fontSize: 12, color: Colors.danger, flex: 1 },
  loginBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, height: 54, borderRadius: 14, marginTop: 8,
    shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 6,
  },
  loginBtnDisabled: { opacity: 0.7 },
  loginBtnText: { fontSize: 16, fontWeight: '700', color: '#FFF' },
  loginLink: { marginTop: 24, alignSelf: 'center', padding: 8 },
  loginLinkText: { fontSize: 13, color: Colors.textSecondary },
});
