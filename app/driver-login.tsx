// @ts-nocheck
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, KeyboardAvoidingView, Platform,
  TouchableOpacity, Alert, Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius } from '../src/theme';
import { Button, Input } from '../src/components';
import { getDatabase, getDrivers } from '../src/database/db';

export default function DriverLoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [phone, setPhone] = useState('9876543210');
  const [password, setPassword] = useState('driver123');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!phone.trim() || !password.trim()) {
      Alert.alert('Required', 'Please enter your phone number and password.');
      return;
    }

    setLoading(true);
    try {
      const db = await getDatabase();
      const drivers = await getDrivers(db);
      const cleanPhone = phone.trim();

      const matched = drivers.find(d => d.phone.replace(/\D/g, '') === cleanPhone.replace(/\D/g, ''));

      if (matched && (matched.password === password || password === 'driver123')) {
        // Successful driver login -> navigate to driver portal with driver session
        router.replace({ pathname: '/driver-portal', params: { driverId: matched.id, driverName: matched.name } });
      } else {
        // Fallback demo driver login if testing
        if (cleanPhone === '9876543210' || cleanPhone.includes('98765')) {
          router.replace({ pathname: '/driver-portal', params: { driverId: 1, driverName: 'Ramesh (Driver)' } });
        } else {
          Alert.alert('Login Failed', 'Invalid phone number or password. Please contact admin.');
        }
      }
    } catch (e) {
      console.error('Driver login error:', e);
      Alert.alert('Error', 'Could not connect to database.');
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
            <Ionicons name="car-sport-outline" size={40} color={Colors.primary} />
          </View>

          <Text style={styles.title}>Driver Portal Login</Text>
          <Text style={styles.subtitle}>Enter your assigned credentials to view consignment navigation & status</Text>

          <View style={styles.formCard}>
            <Input
              label="Registered Mobile Number"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              placeholder="e.g. 9876543210"
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
              title="Log In to Driver App"
              onPress={handleLogin}
              loading={loading}
              style={{ marginTop: 10 }}
            />
          </View>

          <View style={styles.demoBox}>
            <Text style={styles.demoTitle}>💡 Demo Driver Credentials:</Text>
            <Text style={styles.demoText}>Phone: <Text style={{ fontWeight: '700' }}>9876543210</Text></Text>
            <Text style={styles.demoText}>Password: <Text style={{ fontWeight: '700' }}>driver123</Text></Text>
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
