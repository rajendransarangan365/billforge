// @ts-nocheck
import React from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, StatusBar,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../src/theme';
import { useAuth } from '../src/context/AuthContext';

const PORTALS = [
  {
    route: '/admin-portal',
    icon: 'shield-checkmark',
    iconBg: '#FFF3E0',
    iconColor: '#E65100',
    label: 'Admin Control Tower',
    sublabel: 'Register new quarries, platform oversight, driver verifications & audit logs',
    badge: 'Platform Admin',
    badgeBg: '#FFF3E0',
    badgeColor: '#E65100',
  },
  {
    route: '/owner-login',
    icon: 'business',
    iconBg: Colors.primarySurface,
    iconColor: Colors.primary,
    label: 'Quarry Owner Portal',
    sublabel: 'Billing, material catalog, customer ledger, transport assignment & dues tracking',
    badge: 'Quarry Business',
    badgeBg: Colors.primarySurface,
    badgeColor: Colors.primary,
  },
  {
    route: '/driver-login',
    icon: 'car-sport',
    iconBg: '#E3F2FD',
    iconColor: '#1565C0',
    label: 'Transport & Logistics',
    sublabel: 'Trip offers, delivery status updates, PoD submission & earnings tracker',
    badge: 'Drivers',
    badgeBg: '#E3F2FD',
    badgeColor: '#1565C0',
  },
  {
    route: '/customer-login',
    icon: 'storefront',
    iconBg: '#E8F5E9',
    iconColor: '#2E7D32',
    label: 'Customer Enquiry Portal',
    sublabel: 'Browse quarry catalogs, compare prices, submit material enquiries',
    badge: 'Buyers',
    badgeBg: '#E8F5E9',
    badgeColor: '#2E7D32',
  },
];

export default function SelectRoleScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { logout } = useAuth();

  const handlePortalPress = (route) => {
    if (route === '/select-role') return;
    // Logout before switching portal
    logout();
    router.push(route);
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />
      <ScrollView style={styles.scroll} contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 30 }]} showsVerticalScrollIndicator={false}>
        <View style={styles.containerMax}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.logoWrap}>
              <Ionicons name="layers" size={26} color="#FFF" />
            </View>
            <Text style={styles.appName}>BillForge</Text>
            <Text style={styles.tagline}>Multi-Quarry Operations & Supply Chain Platform</Text>
          </View>

          <Text style={styles.sectionLabel}>Select your portal</Text>

          {PORTALS.map((portal) => (
            <TouchableOpacity key={portal.route} style={styles.card} onPress={() => handlePortalPress(portal.route)} activeOpacity={0.78}>
              <View style={[styles.cardIcon, { backgroundColor: portal.iconBg }]}>
                <Ionicons name={portal.icon} size={24} color={portal.iconColor} />
              </View>
              <View style={styles.cardContent}>
                <View style={styles.cardLabelRow}>
                  <Text style={styles.cardLabel}>{portal.label}</Text>
                  <View style={[styles.badgeTag, { backgroundColor: portal.badgeBg }]}>
                    <Text style={[styles.badgeTagText, { color: portal.badgeColor }]}>{portal.badge}</Text>
                  </View>
                </View>
                <Text style={styles.cardSub}>{portal.sublabel}</Text>
              </View>
              <View style={[styles.arrowWrap, { backgroundColor: portal.iconBg }]}>
                <Ionicons name="chevron-forward" size={16} color={portal.iconColor} />
              </View>
            </TouchableOpacity>
          ))}

          {/* Skip link */}
          <TouchableOpacity style={styles.skipBtn} onPress={() => router.replace('/(tabs)')}>
            <Ionicons name="speedometer-outline" size={14} color={Colors.textTertiary} />
            <Text style={styles.skipText}>Skip to Demo Dashboard</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 16 },
  containerMax: { maxWidth: 640, width: '100%', alignSelf: 'center' },
  header: { alignItems: 'center', paddingTop: 20, paddingBottom: 20 },
  logoWrap: { width: 56, height: 56, borderRadius: 16, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  appName: { fontSize: 28, fontWeight: '900', color: Colors.navy, letterSpacing: -0.5 },
  tagline: { fontSize: 13, color: Colors.textSecondary, marginTop: 4, textAlign: 'center' },
  sectionLabel: { fontSize: 11, fontWeight: '700', color: Colors.textTertiary, textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 12 },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, borderRadius: 14, padding: 16, marginBottom: 10, gap: 12, borderWidth: 1, borderColor: Colors.borderLight, shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 6, elevation: 2 },
  cardIcon: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  cardContent: { flex: 1, gap: 3 },
  cardLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  cardLabel: { fontSize: 15, fontWeight: '700', color: Colors.text },
  badgeTag: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  badgeTagText: { fontSize: 10, fontWeight: '700' },
  cardSub: { fontSize: 12, color: Colors.textSecondary, lineHeight: 16 },
  arrowWrap: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  skipBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 16, paddingVertical: 10 },
  skipText: { fontSize: 13, color: Colors.textTertiary, fontWeight: '500' },
});
