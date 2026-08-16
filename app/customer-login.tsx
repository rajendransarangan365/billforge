// @ts-nocheck
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, KeyboardAvoidingView, Platform,
  TouchableOpacity, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius } from '../src/theme';
import { Button, Input } from '../src/components';
import { useAuth } from '../src/context/AuthContext';

export default function CustomerLoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { loginOwner } = useAuth(); // Logged in user session
  const [phone, setPhone] = useState('9876500000');
  const [password, setPassword] = useState('customer123');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!phone.trim() || !password.trim()) {
      Alert.alert('Required', 'Please enter your mobile number and password.');
      return;
    }

    setLoading(true);
    try {
      const customerUser = {
        id: 'cust-1',
        name: 'Anand Construction',
        phone: phone.trim(),
        role: 'customer',
      };
      loginOwner(customerUser);
      router.replace('/customer-marketplace');
    } catch (e) {
      Alert.alert('Error', 'Login failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>

        <View style={styles.content}>
          <View style={[styles.iconCircle, { backgroundColor: '#DCFCE7' }]}>
            <Ionicons name="cart" size={40} color="#16A34A" />
          </View>

          <Text style={styles.title}>Customer Portal Login</Text>
          <Text style={styles.subtitle}>Enter your mobile & password to post material requirements & track lorries live</Text>

          <View style={styles.formCard}>
            <Input
              label="Registered Mobile Number"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              placeholder="e.g. 9876500000"
              icon="call-outline"
            />
            <Input
              label="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              placeholder="••••••••"
              icon="key-outline"
            />

            <Button
              title="Log In to Customer Portal"
              onPress={handleLogin}
              loading={loading}
              style={{ marginTop: 10, backgroundColor: '#16A34A' }}
            />
          </View>

          <View style={styles.demoBox}>
            <Text style={[styles.demoTitle, { color: '#16A34A' }]}>💡 Demo Customer Credentials:</Text>
            <Text style={styles.demoText}>Phone: <Text style={{ fontWeight: '700' }}>9876500000</Text></Text>
            <Text style={styles.demoText}>Password: <Text style={{ fontWeight: '700' }}>customer123</Text></Text>
          </View>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  backBtn: { marginHorizontal: Spacing.xl, marginTop: Spacing.md, padding: 4 },
  content: { flex: 1, paddingHorizontal: Spacing.xl, justifyContent: 'center', marginTop: -30 },
  iconCircle: {
    width: 80, height: 80, borderRadius: 40,
    alignItems: 'center', justifyContent: 'center',
    alignSelf: 'center', marginBottom: Spacing.lg,
  },
  title: { ...Typography.h1, color: Colors.text, textAlign: 'center' },
  subtitle: { ...Typography.caption, color: Colors.textSecondary, textAlign: 'center', marginTop: 4, marginBottom: Spacing.xl },
  formCard: {
    backgroundColor: Colors.surface, borderRadius: BorderRadius.xl,
    padding: Spacing.lg, borderWidth: 1, borderColor: Colors.borderLight,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, elevation: 2,
  },
  demoBox: {
    backgroundColor: Colors.backgroundSecondary, borderRadius: BorderRadius.md,
    padding: Spacing.md, marginTop: Spacing.xl, borderWidth: 1, borderColor: Colors.borderLight,
    alignItems: 'center', gap: 2,
  },
  demoTitle: { ...Typography.captionSemibold, marginBottom: 2 },
  demoText: { ...Typography.caption, color: Colors.textSecondary },
});
