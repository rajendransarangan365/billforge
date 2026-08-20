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
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../src/theme';

const ROLES = [
  {
    route: '/owner-login',
    icon: 'business' as const,
    iconBg: Colors.primarySurface,
    iconColor: Colors.primary,
    label: 'Quarry Owner Login',
    sublabel: 'Sign in to company bills, auto-resume drafts, customer ledgers & transport',
    badge: 'Owner Access',
    badgeBg: Colors.primarySurface,
    badgeColor: Colors.primary,
  },
  {
    route: '/owner-register',
    icon: 'person-add' as const,
    iconBg: '#EBF5FB',
    iconColor: Colors.primary,
    label: 'Register New Quarry',
    sublabel: 'Onboard business details, default material prices & transport drivers',
    badge: 'New Onboarding',
    badgeBg: '#EBF5FB',
    badgeColor: Colors.primary,
  },
  {
    route: '/customer-login',
    icon: 'construct' as const,
    iconBg: Colors.statusAgreedBg,
    iconColor: Colors.success,
    label: 'Customer Portal',
    sublabel: 'Material catalog, site pinning, quote bargaining & multi-trip tracker',
    badge: 'Buyers',
    badgeBg: Colors.statusAgreedBg,
    badgeColor: Colors.success,
  },
  {
    route: '/driver-login',
    icon: 'car-sport' as const,
    iconBg: Colors.infoLight,
    iconColor: Colors.info,
    label: 'Lorry Driver',
    sublabel: 'Online delivery radar, trip offers, map navigation & PoD submission',
    badge: 'Logistics',
    badgeBg: Colors.infoLight,
    badgeColor: Colors.info,
  },
  {
    route: '/admin-portal',
    icon: 'shield-checkmark' as const,
    iconBg: Colors.warningLight,
    iconColor: Colors.warning,
    label: 'Admin Control Tower',
    sublabel: 'Live logistics map, driver verifications, audit logs & system metrics',
    badge: 'System Admin',
    badgeBg: Colors.warningLight,
    badgeColor: Colors.warning,
  },
];

export default function SelectRoleScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 30 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.containerMax}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.logoWrap}>
              <Ionicons name="layers" size={28} color={Colors.primary} />
            </View>
            <Text style={styles.appName}>BuildRoute</Text>
            <Text style={styles.tagline}>Construction Material Marketplace & Quarry Operations</Text>
          </View>

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
                <Ionicons name={role.icon} size={24} color={role.iconColor} />
              </View>

              {/* Content */}
              <View style={styles.cardContent}>
                <View style={styles.cardLabelRow}>
                  <Text style={styles.cardLabel}>{role.label}</Text>
                  {role.badge ? (
                    <View style={[styles.badgeTag, { backgroundColor: role.badgeBg }]}>
                      <Text style={[styles.badgeTagText, { color: role.badgeColor }]}>{role.badge}</Text>
                    </View>
                  ) : null}
                </View>
                <Text style={styles.cardSub}>{role.sublabel}</Text>
              </View>

              {/* Arrow */}
              <View style={[styles.arrowWrap, { backgroundColor: role.iconBg }]}>
                <Ionicons name="chevron-forward" size={16} color={role.iconColor} />
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
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  containerMax: {
    maxWidth: 640,
    width: '100%',
    alignSelf: 'center',
  },
  header: {
    alignItems: 'center',
    paddingTop: 16,
    paddingBottom: 16,
    paddingHorizontal: 24,
  },
  logoWrap: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: Colors.primarySurface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Colors.primaryBorder,
  },
  appName: {
    fontSize: 24,
    fontWeight: '800',
    color: Colors.navy,
    letterSpacing: -0.5,
  },
  tagline: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
    textAlign: 'center',
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: 10,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    gap: 12,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
    elevation: 2,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  cardIcon: {
    width: 46,
    height: 46,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardContent: {
    flex: 1,
    gap: 2,
  },
  cardLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
  },
  badgeTag: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  badgeTagText: {
    fontSize: 10,
    fontWeight: '700',
  },
  cardSub: {
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 16,
  },
  arrowWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 16,
    paddingVertical: 10,
  },
  skipText: {
    fontSize: 13,
    color: Colors.textTertiary,
    fontWeight: '500',
  },
});
