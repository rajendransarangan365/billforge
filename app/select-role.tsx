// @ts-nocheck
import React from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
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
        <Text style={styles.title}>BillForge Quarry & Lorry Marketplace</Text>
        <Text style={styles.subtitle}>Select your portal role to access your dispatch workspace</Text>
      </View>

      {/* Role Selection Cards */}
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.cardsWrap}>
        {/* Customer Portal */}
        <TouchableOpacity
          style={styles.roleCard}
          onPress={() => router.push('/customer-marketplace')}
          activeOpacity={0.82}
        >
          <View style={[styles.iconCircle, { backgroundColor: '#DCFCE7' }]}>
            <Ionicons name="cart" size={32} color="#16A34A" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>👷 Customer Portal</Text>
            <Text style={styles.cardSub}>Post material requirements, track lorry live, Walkie-Talkie & share documents</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#16A34A" />
        </TouchableOpacity>

        {/* Quarry Owner Login Card */}
        <TouchableOpacity
          style={styles.roleCard}
          onPress={() => router.push('/quarry-marketplace')}
          activeOpacity={0.82}
        >
          <View style={[styles.iconCircle, { backgroundColor: Colors.primarySurface }]}>
            <Ionicons name="business" size={32} color={Colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>🏢 Quarry Owner Portal</Text>
            <Text style={styles.cardSub}>Quote material rates, review lorry transport bids, assign pickup & settle driver fares</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={Colors.primary} />
        </TouchableOpacity>

        {/* Driver App Login Card */}
        <TouchableOpacity
          style={styles.roleCard}
          onPress={() => router.push('/driver-marketplace')}
          activeOpacity={0.82}
        >
          <View style={[styles.iconCircle, { backgroundColor: '#EFF6FF' }]}>
            <Ionicons name="car-sport" size={32} color="#2563EB" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>🚚 Lorry Driver Transport Desk</Text>
            <Text style={styles.cardSub}>Submit transport price quotes, Google Maps navigation, mark loaded/delivered & Walkie-Talkie</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#2563EB" />
        </TouchableOpacity>
      </ScrollView>

      {/* Direct Guest Quick Switch */}
      <TouchableOpacity
        style={styles.quickGuestBtn}
        onPress={() => router.replace('/(tabs)')}
      >
        <Text style={styles.quickGuestText}>Skip to Owner Billing Dashboard ➔</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background, paddingHorizontal: Spacing.xl },
  header: { alignItems: 'center', marginTop: Spacing.xl, marginBottom: Spacing.lg },
  logoCircle: { width: 64, height: 64, borderRadius: 32, backgroundColor: Colors.primarySurface, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.sm },
  title: { ...Typography.h1, color: Colors.text, fontSize: 24, textAlign: 'center' },
  subtitle: { ...Typography.caption, color: Colors.textSecondary, textAlign: 'center', marginTop: 4, maxWidth: 300 },
  cardsWrap: { gap: Spacing.md, paddingBottom: Spacing.lg },
  roleCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: Colors.surface, borderRadius: BorderRadius.xl,
    padding: Spacing.lg, borderWidth: 1, borderColor: Colors.borderLight,
    elevation: 3, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 10,
  },
  iconCircle: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { ...Typography.bodyLargeBold, color: Colors.text, fontSize: 16 },
  cardSub: { ...Typography.caption, color: Colors.textSecondary, marginTop: 3 },
  quickGuestBtn: { marginVertical: Spacing.lg, alignSelf: 'center', padding: Spacing.sm },
  quickGuestText: { ...Typography.captionSemibold, color: Colors.primary },
});
