// @ts-nocheck
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  StatusBar,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../src/theme';

const { width: W } = Dimensions.get('window');

const ROLES = [
  {
    route: '/owner-login',
    icon: 'business' as const,
    iconBg: Colors.primarySurface,
    iconColor: Colors.primary,
    label: 'Quarry Owner Login',
    sublabel: 'Sign in to company bills, auto-resume drafts, customer ledgers & transport',
    badgeColor: Colors.primary,
  },
  {
    route: '/owner-register',
    icon: 'person-add' as const,
    iconBg: '#EBF5FB',
    iconColor: Colors.primary,
    label: 'Register New Quarry',
    sublabel: 'Onboard business details, default material prices & transport drivers',
    badgeColor: Colors.primary,
  },
  {
    route: '/customer-login',
    icon: 'construct' as const,
    iconBg: Colors.statusAgreedBg,
    iconColor: Colors.success,
    label: 'Customer Portal',
    sublabel: 'Material catalog, site pinning, quote bargaining & multi-trip tracker',
    badgeColor: Colors.success,
  },
  {
    route: '/driver-login',
    icon: 'car-sport' as const,
    iconBg: Colors.infoLight,
    iconColor: Colors.info,
    label: 'Lorry Driver',
    sublabel: 'Online delivery radar, trip offers, map navigation & PoD submission',
    badgeColor: Colors.info,
  },
  {
    route: '/admin-portal',
    icon: 'shield-checkmark' as const,
    iconBg: Colors.warningLight,
    iconColor: Colors.warning,
    label: 'Admin Control Tower',
    sublabel: 'Live logistics map, driver verifications, audit logs & system metrics',
    badgeColor: Colors.warning,
  },
];

export default function SelectRoleScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.logoWrap}>
          <Ionicons name="layers" size={28} color={Colors.primary} />
        </View>
        <Text style={styles.appName}>BuildRoute</Text>
        <Text style={styles.tagline}>Construction Material Marketplace & Logistics Platform</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.sectionLabel}>Choose your portal</Text>

        {ROLES.map((role) => (
          <TouchableOpacity
            key={role.route}
            style={styles.card}
            onPress={() => router.push(role.route)}
            activeOpacity={0.78}
          >
            {/* Left icon */}
            <View style={[styles.cardIcon, { backgroundColor: role.iconBg }]}>
              <Ionicons name={role.icon} size={26} color={role.iconColor} />
            </View>

            {/* Content */}
            <View style={styles.cardContent}>
              <Text style={styles.cardLabel}>{role.label}</Text>
              <Text style={styles.cardSub}>{role.sublabel}</Text>
            </View>

            {/* Arrow */}
            <View style={[styles.arrowWrap, { backgroundColor: role.iconBg }]}>
              <Ionicons name="chevron-forward" size={18} color={role.iconColor} />
            </View>
          </TouchableOpacity>
        ))}

        {/* Skip link */}
        <TouchableOpacity
          style={styles.skipBtn}
          onPress={() => router.replace('/(tabs)')}
        >
          <Ionicons name="speedometer-outline" size={14} color={Colors.textTertiary} />
          <Text style={styles.skipText}>Skip to Billing Dashboard</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    alignItems: 'center',
    paddingTop: 32,
    paddingBottom: 24,
    paddingHorizontal: 24,
  },
  logoWrap: {
    width: 60,
    height: 60,
    borderRadius: 16,
    backgroundColor: Colors.primarySurface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.primaryBorder,
  },
  appName: {
    fontSize: 26,
    fontWeight: '800',
    color: Colors.navy,
    letterSpacing: -0.5,
  },
  tagline: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 4,
    textAlign: 'center',
  },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: 14,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 18,
    marginBottom: 12,
    gap: 14,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 10,
    elevation: 3,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  cardIcon: {
    width: 52,
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardContent: {
    flex: 1,
    gap: 4,
  },
  cardLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
  },
  cardSub: {
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 17,
  },
  arrowWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 24,
    paddingVertical: 12,
  },
  skipText: {
    fontSize: 13,
    color: Colors.textTertiary,
    fontWeight: '500',
  },
});
