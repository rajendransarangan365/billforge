// @ts-nocheck
import React from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius } from '../src/theme';

export default function SelectRoleScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Brand Header */}
      <View style={styles.header}>
        <View style={styles.logoCircle}>
          <Ionicons name="business" size={32} color={Colors.primary} />
        </View>
        <Text style={styles.title}>BillForge Quarry Portal</Text>
        <Text style={styles.subtitle}>Select your login portal to access your workspace</Text>
      </View>

      {/* Role Selection Cards */}
      <View style={styles.cardsWrap}>
        {/* Quarry Owner Login Card */}
        <TouchableOpacity
          style={styles.roleCard}
          onPress={() => router.push('/owner-login')}
          activeOpacity={0.82}
        >
          <View style={[styles.iconCircle, { backgroundColor: Colors.primarySurface }]}>
            <Ionicons name="business" size={36} color={Colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>Quarry Owner / Admin</Text>
            <Text style={styles.cardSub}>Financial Dashboard, Ledger, Rate Enquiries, Drivers & Live Map</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={Colors.primary} />
        </TouchableOpacity>

        {/* Driver App Login Card */}
        <TouchableOpacity
          style={styles.roleCard}
          onPress={() => router.push('/driver-login')}
          activeOpacity={0.82}
        >
          <View style={[styles.iconCircle, { backgroundColor: '#EFF6FF' }]}>
            <Ionicons name="car-sport" size={36} color="#2563EB" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>Driver Navigation App</Text>
            <Text style={styles.cardSub}>Assigned Consignments, Google Maps Navigation & Walkie-Talkie</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#2563EB" />
        </TouchableOpacity>
      </View>

      {/* Direct Guest Quick Switch */}
      <TouchableOpacity
        style={styles.quickGuestBtn}
        onPress={() => router.replace('/(tabs)')}
      >
        <Text style={styles.quickGuestText}>Skip to Owner Dashboard ➔</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background, paddingHorizontal: Spacing.xl, justifyContent: 'center' },
  header: { alignItems: 'center', marginBottom: Spacing.xxl },
  logoCircle: { width: 68, height: 68, borderRadius: 34, backgroundColor: Colors.primarySurface, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.md },
  title: { ...Typography.h1, color: Colors.text, fontSize: 26, textAlign: 'center' },
  subtitle: { ...Typography.caption, color: Colors.textSecondary, textAlign: 'center', marginTop: 6, maxWidth: 280 },
  cardsWrap: { gap: Spacing.lg },
  roleCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: Colors.surface, borderRadius: BorderRadius.xl,
    padding: Spacing.lg, borderWidth: 1, borderColor: Colors.borderLight,
    elevation: 3, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 10,
  },
  iconCircle: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { ...Typography.bodyLargeBold, color: Colors.text, fontSize: 17 },
  cardSub: { ...Typography.caption, color: Colors.textSecondary, marginTop: 3 },
  quickGuestBtn: { marginTop: Spacing.xxl, alignSelf: 'center', padding: Spacing.sm },
  quickGuestText: { ...Typography.captionSemibold, color: Colors.primary },
});
