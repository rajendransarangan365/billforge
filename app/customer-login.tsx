// @ts-nocheck
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, KeyboardAvoidingView, Platform,
  TouchableOpacity, ScrollView, TextInput, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../src/theme';
import { useAuth } from '../src/context/AuthContext';
import { getDatabase, authenticateCustomer } from '../src/database/db';

export default function CustomerLoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { loginCustomer } = useAuth();

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async () => {
    setError('');
    if (!phone.trim()) { setError('Please enter your mobile number.'); return; }

    setLoading(true);
    try {
      const db = await getDatabase();
      const user = await authenticateCustomer(db, phone.trim());
      if (name.trim()) user.name = name.trim();
      loginCustomer(user);
      router.replace('/customer-marketplace');
    } catch (e) {
      setError('Login failed. Please try again.');
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
          <Ionicons name="storefront" size={34} color="#2E7D32" />
        </View>

        <Text style={styles.title}>Customer Portal Login</Text>
        <Text style={styles.subtitle}>
          Browse quarry catalogs, compare prices, and submit material enquiries
        </Text>

        <View style={styles.form}>
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Your Name / Company (Optional)</Text>
            <View style={styles.inputWrap}>
              <Ionicons name="person-outline" size={18} color={Colors.textTertiary} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="e.g. Anand Construction"
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
                returnKeyType="done"
                onSubmitEditing={handleLogin}
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
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.82}
          >
            {loading
              ? <ActivityIndicator color="#FFF" size="small" />
              : (
                <>
                  <Text style={styles.loginBtnText}>Browse Quarry Catalogs</Text>
                  <Ionicons name="arrow-forward" size={18} color="#FFF" />
                </>
              )
            }
          </TouchableOpacity>
        </View>

        <View style={[styles.demoBox]}>
          <Ionicons name="information-circle-outline" size={14} color="#2E7D32" />
          <Text style={styles.demoText}>
            Enter mobile number to view live material prices across all registered quarries.
          </Text>
        </View>
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
    borderWidth: 1, borderColor: Colors.border, marginBottom: 28,
  },
  iconWrap: {
    width: 72, height: 72, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
    alignSelf: 'center', marginBottom: 20,
  },
  title: { fontSize: 24, fontWeight: '800', color: Colors.navy, textAlign: 'center', letterSpacing: -0.4 },
  subtitle: { fontSize: 13, color: Colors.textSecondary, textAlign: 'center', marginTop: 6, lineHeight: 19, marginBottom: 32 },
  form: { gap: 16 },
  fieldGroup: { gap: 6 },
  label: { fontSize: 13, fontWeight: '600', color: Colors.text },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.surface, borderWidth: 1.5, borderColor: Colors.border,
    borderRadius: 12, overflow: 'hidden',
  },
  inputIcon: { paddingLeft: 14 },
  input: { flex: 1, height: 52, paddingHorizontal: 12, fontSize: 15, color: Colors.text },
  errorBox: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.dangerLight, borderRadius: 10, padding: 10,
    borderWidth: 1, borderColor: Colors.dangerBorder,
  },
  errorText: { fontSize: 12, color: Colors.danger, flex: 1 },
  loginBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, height: 56, borderRadius: 14, marginTop: 8,
    shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 6,
  },
  loginBtnDisabled: { opacity: 0.7 },
  loginBtnText: { fontSize: 16, fontWeight: '700', color: '#FFF' },
  demoBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 6,
    backgroundColor: '#E8F5E9', borderRadius: 10, padding: 12, marginTop: 28,
    borderWidth: 1, borderColor: '#C8E6C9',
  },
  demoText: { fontSize: 12, color: '#2E7D32', flex: 1, lineHeight: 18 },
});
