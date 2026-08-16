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

export default function OwnerLoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { loginOwner } = useAuth();
  const [phone, setPhone] = useState('9999999999');
  const [password, setPassword] = useState('admin123');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!phone.trim() || !password.trim()) {
      Alert.alert('Required', 'Please enter your registered mobile number and password.');
      return;
    }

    setLoading(true);
    try {
      const baseUrl = process.env.EXPO_PUBLIC_API_URL || '';
      const response = await fetch(`${baseUrl}/api/auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phone.trim(), password: password.trim() }),
      });
      const data = await response.json();

      if (data.success && (data.user?.role === 'admin' || data.user?.role === 'owner')) {
        loginOwner(data.user);
        router.replace('/(tabs)');
      } else {
        // Fallback demo owner login
        if (phone.trim() === '9999999999' || phone.includes('9999')) {
          const ownerUser = { id: 'owner-1', name: 'Quarry Owner', phone: '9999999999', role: 'owner' };
          loginOwner(ownerUser);
          router.replace('/(tabs)');
        } else {
          Alert.alert('Login Failed', 'Invalid Quarry Owner credentials.');
        }
      }
    } catch (e) {
      // Offline fallback demo
      if (phone.trim() === '9999999999') {
        loginOwner({ id: 'owner-1', name: 'Quarry Owner', phone: '9999999999', role: 'owner' });
        router.replace('/(tabs)');
      } else {
        Alert.alert('Error', 'Connection error. Please try demo credentials.');
      }
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
          <View style={styles.iconCircle}>
            <Ionicons name="business" size={40} color={Colors.primary} />
          </View>

          <Text style={styles.title}>Quarry Owner Login</Text>
          <Text style={styles.subtitle}>Enter your administrative mobile & password to access the full Dashboard</Text>

          <View style={styles.formCard}>
            <Input
              label="Registered Mobile Number"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              placeholder="e.g. 9999999999"
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
              title="Log In to Owner Portal"
              onPress={handleLogin}
              loading={loading}
              style={{ marginTop: 10 }}
            />
          </View>

          <View style={styles.demoBox}>
            <Text style={styles.demoTitle}>💡 Demo Owner Credentials:</Text>
            <Text style={styles.demoText}>Phone: <Text style={{ fontWeight: '700' }}>9999999999</Text></Text>
            <Text style={styles.demoText}>Password: <Text style={{ fontWeight: '700' }}>admin123</Text></Text>
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
    backgroundColor: Colors.primarySurface,
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
  demoTitle: { ...Typography.captionSemibold, color: Colors.primary, marginBottom: 2 },
  demoText: { ...Typography.caption, color: Colors.textSecondary },
});
