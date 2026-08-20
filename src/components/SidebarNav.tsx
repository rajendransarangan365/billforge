// @ts-nocheck
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
} from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../theme';
import { useAuth } from '../context/AuthContext';

const ADMIN_NAV = [
  { title: 'PLATFORM MANAGEMENT', items: [
    { route: '/admin-portal', icon: 'shield-checkmark-outline', activeIcon: 'shield-checkmark', label: 'Quarry Registry' },
    { route: '/(tabs)', icon: 'grid-outline', activeIcon: 'grid', label: 'Platform Overview' },
  ]},
  { title: 'ACCOUNT', items: [
    { route: '/select-role', icon: 'swap-horizontal-outline', activeIcon: 'swap-horizontal', label: 'Switch Portal / Logout' },
  ]},
];

const OWNER_NAV = [
  { title: 'BILLING & INVOICING', items: [
    { route: '/(tabs)', icon: 'grid-outline', activeIcon: 'grid', label: 'Dashboard' },
    { route: '/bill-form/1', icon: 'add-circle-outline', activeIcon: 'add-circle', label: 'New Bill' },
    { route: '/(tabs)/templates', icon: 'document-text-outline', activeIcon: 'document-text', label: 'Templates' },
    { route: '/(tabs)/history', icon: 'receipt-outline', activeIcon: 'receipt', label: 'Bills & History' },
    { route: '/(tabs)/materials', icon: 'cube-outline', activeIcon: 'cube', label: 'Material Catalog' },
  ]},
  { title: 'QUARRY OPERATIONS', items: [
    { route: '/customers', icon: 'people-outline', activeIcon: 'people', label: 'Customer Directory' },
    { route: '/drivers', icon: 'car-sport-outline', activeIcon: 'car-sport', label: 'Transport & Drivers' },
    { route: '/enquiries', icon: 'chatbubbles-outline', activeIcon: 'chatbubbles', label: 'Enquiries' },
    { route: '/ledger', icon: 'book-outline', activeIcon: 'book', label: 'Ledger & Dues' },
    { route: '/reminders', icon: 'time-outline', activeIcon: 'time', label: 'Payment Reminders' },
  ]},
  { title: 'SETTINGS', items: [
    { route: '/(tabs)/profile', icon: 'business-outline', activeIcon: 'business', label: 'Company Profile' },
    { route: '/select-role', icon: 'swap-horizontal-outline', activeIcon: 'swap-horizontal', label: 'Switch Portal' },
  ]},
];

const DRIVER_NAV = [
  { title: 'MY TRIPS', items: [
    { route: '/driver-portal', icon: 'navigate-outline', activeIcon: 'navigate', label: 'Active Trips' },
  ]},
  { title: 'ACCOUNT', items: [
    { route: '/select-role', icon: 'swap-horizontal-outline', activeIcon: 'swap-horizontal', label: 'Switch Portal' },
  ]},
];

const CUSTOMER_NAV = [
  { title: 'MARKETPLACE', items: [
    { route: '/customer-marketplace', icon: 'storefront-outline', activeIcon: 'storefront', label: 'Browse Quarries' },
  ]},
  { title: 'ACCOUNT', items: [
    { route: '/select-role', icon: 'swap-horizontal-outline', activeIcon: 'swap-horizontal', label: 'Switch Portal' },
  ]},
];

export function SidebarNav() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, role, quarryId } = useAuth();
  const [collapsed, setCollapsed] = useState(false);

  const navSections = role === 'admin' ? ADMIN_NAV
    : role === 'quarry_owner' ? OWNER_NAV
    : role === 'driver' ? DRIVER_NAV
    : role === 'customer' ? CUSTOMER_NAV
    : OWNER_NAV; // fallback

  const isCurrentRoute = (r) => {
    if (r === '/(tabs)' && (pathname === '/' || pathname === '/(tabs)' || pathname === '/(tabs)/index')) return true;
    if (r === '/bill-form/1' && pathname.includes('/bill-form')) return true;
    return pathname.startsWith(r);
  };

  const brandName = role === 'admin' ? 'Admin Panel'
    : role === 'driver' ? 'Driver Portal'
    : role === 'customer' ? 'Customer Portal'
    : 'BillForge';

  const subLabel = role === 'admin' ? 'Platform Admin'
    : role === 'driver' ? (user?.name || 'Driver')
    : role === 'customer' ? (user?.phone || 'Customer')
    : (user?.name || user?.owner_name || 'Quarry Owner');

  return (
    <View style={[styles.sidebar, collapsed && styles.sidebarCollapsed]}>
      {/* Brand Header */}
      <View style={styles.brandHeader}>
        <View style={[styles.logoWrap, role === 'admin' && { backgroundColor: Colors.warning }, role === 'driver' && { backgroundColor: Colors.info }, role === 'customer' && { backgroundColor: Colors.success }]}>
          <Ionicons name={role === 'admin' ? 'shield' : role === 'driver' ? 'car-sport' : role === 'customer' ? 'storefront' : 'layers'} size={20} color="#FFF" />
        </View>
        {!collapsed && (
          <View style={styles.brandTextWrap}>
            <Text style={styles.appName}>{brandName}</Text>
            <Text style={styles.companySub} numberOfLines={1}>{subLabel}</Text>
          </View>
        )}
        <TouchableOpacity style={styles.collapseToggle} onPress={() => setCollapsed(!collapsed)} activeOpacity={0.7}>
          <Ionicons name={collapsed ? 'chevron-forward' : 'chevron-back'} size={16} color={Colors.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* Nav Sections */}
      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {navSections.map((section, sIdx) => (
          <View key={section.title || sIdx} style={styles.sectionWrap}>
            {!collapsed && <Text style={styles.sectionHeader}>{section.title}</Text>}
            {section.items.map((item) => {
              const active = isCurrentRoute(item.route);
              return (
                <TouchableOpacity key={item.route} style={[styles.navItem, active && styles.navItemActive]} onPress={() => router.push(item.route)} activeOpacity={0.78}>
                  <Ionicons name={active ? item.activeIcon : item.icon} size={20} color={active ? Colors.primary : Colors.textSecondary} />
                  {!collapsed && <Text style={[styles.navLabel, active && styles.navLabelActive]} numberOfLines={1}>{item.label}</Text>}
                  {active && !collapsed && <View style={styles.activeDot} />}
                </TouchableOpacity>
              );
            })}
          </View>
        ))}
      </ScrollView>

      {/* Footer */}
      {!collapsed && (
        <View style={styles.sidebarFooter}>
          <View style={styles.userStatusDot} />
          <View style={{ flex: 1 }}>
            <Text style={styles.userStatusText} numberOfLines={1}>{user?.phone || 'Active'}</Text>
            <Text style={styles.userRoleText}>{role === 'admin' ? 'Admin' : role === 'quarry_owner' ? 'Quarry Owner' : role === 'driver' ? 'Driver' : 'Customer'}</Text>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  sidebar: { width: 240, backgroundColor: Colors.surface, borderRightWidth: 1, borderRightColor: Colors.borderLight, height: '100%', flexDirection: 'column', zIndex: 100 },
  sidebarCollapsed: { width: 64 },
  brandHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: Colors.borderLight, gap: 10 },
  logoWrap: { width: 36, height: 36, borderRadius: 10, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  brandTextWrap: { flex: 1 },
  appName: { fontSize: 16, fontWeight: '800', color: Colors.navy, letterSpacing: -0.3 },
  companySub: { fontSize: 11, color: Colors.textSecondary, marginTop: 1 },
  collapseToggle: { width: 26, height: 26, borderRadius: 7, backgroundColor: Colors.background, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.border },
  scroll: { flex: 1, paddingTop: 10 },
  sectionWrap: { marginBottom: 16, paddingHorizontal: 10 },
  sectionHeader: { fontSize: 10, fontWeight: '700', color: Colors.textTertiary, letterSpacing: 1, marginBottom: 6, paddingHorizontal: 8 },
  navItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 10, borderRadius: 8, marginBottom: 2, gap: 10 },
  navItemActive: { backgroundColor: Colors.primarySurface },
  navLabel: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary, flex: 1 },
  navLabelActive: { color: Colors.primary, fontWeight: '700' },
  activeDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.primary },
  sidebarFooter: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12, borderTopWidth: 1, borderTopColor: Colors.borderLight, backgroundColor: Colors.background, gap: 8 },
  userStatusDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.success },
  userStatusText: { fontSize: 11, fontWeight: '700', color: Colors.text },
  userRoleText: { fontSize: 10, color: Colors.textTertiary },
});
