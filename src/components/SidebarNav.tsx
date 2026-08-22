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
    { route: '/messages', icon: 'logo-whatsapp', activeIcon: 'logo-whatsapp', label: 'Messages & WhatsApp' },
    { route: '/(tabs)', icon: 'grid-outline', activeIcon: 'grid', label: 'Platform Overview' },
  ]},
  { title: 'ACCOUNT', items: [
    { route: '/select-role', icon: 'swap-horizontal-outline', activeIcon: 'swap-horizontal', label: 'Switch Portal' },
    { isLogout: true, icon: 'log-out-outline', activeIcon: 'log-out', label: 'Logout' },
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
    { route: '/messages', icon: 'logo-whatsapp', activeIcon: 'logo-whatsapp', label: 'Messages & Live Chat' },
    { route: '/customers', icon: 'people-outline', activeIcon: 'people', label: 'Customer Directory' },
    { route: '/drivers', icon: 'car-sport-outline', activeIcon: 'car-sport', label: 'Transport & Drivers' },
    { route: '/transport-assignment', icon: 'git-network-outline', activeIcon: 'git-network', label: 'Assign Transport' },
    { route: '/driver-marketplace', icon: 'navigate-circle-outline', activeIcon: 'navigate-circle', label: 'Lorry Marketplace' },
    { route: '/enquiries', icon: 'chatbubbles-outline', activeIcon: 'chatbubbles', label: 'Enquiries' },
    { route: '/ledger', icon: 'book-outline', activeIcon: 'book', label: 'Ledger & Dues' },
    { route: '/reminders', icon: 'time-outline', activeIcon: 'time', label: 'Payment Reminders' },
    { route: '/earnings', icon: 'cash-outline', activeIcon: 'cash', label: 'Earnings Dashboard' },
    { route: '/material-catalog', icon: 'pricetags-outline', activeIcon: 'pricetags', label: 'Manage Catalog' },
  ]},
  { title: 'SETTINGS', items: [
    { route: '/(tabs)/profile', icon: 'business-outline', activeIcon: 'business', label: 'Company Profile' },
    { route: '/select-role', icon: 'swap-horizontal-outline', activeIcon: 'swap-horizontal', label: 'Switch Portal' },
    { isLogout: true, icon: 'log-out-outline', activeIcon: 'log-out', label: 'Logout' },
  ]},
];

const DRIVER_NAV = [
  { title: 'MY TRIPS', items: [
    { route: '/driver-portal', icon: 'navigate-outline', activeIcon: 'navigate', label: 'Active Trips' },
    { route: '/driver-marketplace', icon: 'navigate-circle-outline', activeIcon: 'navigate-circle', label: 'Delivery Orders Feed' },
    { route: '/messages', icon: 'logo-whatsapp', activeIcon: 'logo-whatsapp', label: 'Messages & WhatsApp' },
    { route: '/earnings', icon: 'cash-outline', activeIcon: 'cash', label: 'My Earnings' },
  ]},
  { title: 'ACCOUNT', items: [
    { route: '/select-role', icon: 'swap-horizontal-outline', activeIcon: 'swap-horizontal', label: 'Switch Portal' },
    { isLogout: true, icon: 'log-out-outline', activeIcon: 'log-out', label: 'Logout' },
  ]},
];

const CUSTOMER_NAV = [
  { title: 'MARKETPLACE', items: [
    { route: '/customer-marketplace', icon: 'storefront-outline', activeIcon: 'storefront', label: 'Browse Quarries' },
    { route: '/messages', icon: 'logo-whatsapp', activeIcon: 'logo-whatsapp', label: 'Messages & WhatsApp' },
  ]},
  { title: 'ACCOUNT', items: [
    { route: '/select-role', icon: 'swap-horizontal-outline', activeIcon: 'swap-horizontal', label: 'Switch Portal' },
    { isLogout: true, icon: 'log-out-outline', activeIcon: 'log-out', label: 'Logout' },
  ]},
];

import { useWindowDimensions } from 'react-native';

export function SidebarNav() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, role, quarryId, logout } = useAuth();
  const { width } = useWindowDimensions();
  const isMobile = width < 768;

  const [collapsed, setCollapsed] = useState(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  // Hide sidebar whenever NO user is logged in
  if (!user) {
    return null;
  }

  // Hide on explicit auth/role-selection screens
  const AUTH_ROUTES = [
    '/select-role',
    '/owner-login', '/owner-register',
    '/driver-login',
    '/customer-login', '/customer-register',
    '/admin-login',
  ];

  const isAuthRoute = AUTH_ROUTES.includes(pathname) ||
    pathname.includes('login') ||
    pathname.includes('register') ||
    pathname === '/select-role';

  if (isAuthRoute) {
    return null;
  }


  const handleLogout = () => {
    logout();
    setMobileDrawerOpen(false);
    router.replace('/select-role');
  };

  const navSections = role === 'admin' || pathname.startsWith('/admin') ? ADMIN_NAV
    : role === 'driver' || pathname.startsWith('/driver') ? DRIVER_NAV
    : role === 'customer' || pathname.startsWith('/customer') ? CUSTOMER_NAV
    : OWNER_NAV;

  const isCurrentRoute = (r) => {
    if (r === '/(tabs)' && (pathname === '/(tabs)' || pathname === '/(tabs)/index' || pathname === '/quarry')) return true;
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

  // Mobile Top Navigation Bar with Hamburger Drawer Toggle
  if (isMobile) {
    return (
      <View style={mobileStyles.topMobileWrap}>
        <View style={mobileStyles.topMobileBar}>
          <TouchableOpacity style={mobileStyles.menuBtn} onPress={() => setMobileDrawerOpen(!mobileDrawerOpen)}>
            <Ionicons name={mobileDrawerOpen ? 'close' : 'menu'} size={24} color={Colors.navy} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={mobileStyles.mobileBrand}>{brandName}</Text>
            <Text style={mobileStyles.mobileSub} numberOfLines={1}>{subLabel}</Text>
          </View>
          <TouchableOpacity style={mobileStyles.roleSwitchBtn} onPress={() => router.push('/select-role')}>
            <Ionicons name="swap-horizontal" size={18} color={Colors.primary} />
          </TouchableOpacity>
        </View>

        {mobileDrawerOpen && (
          <View style={mobileStyles.drawerOverlay}>
            <ScrollView style={mobileStyles.drawerScroll} showsVerticalScrollIndicator={false}>
              {navSections.map((section, sIdx) => (
                <View key={section.title || sIdx} style={{ marginBottom: 14 }}>
                  <Text style={mobileStyles.sectionHeader}>{section.title}</Text>
                  {section.items.map((item, iIdx) => {
                    if (item.isLogout) {
                      return (
                        <TouchableOpacity
                          key="logout-item-mob"
                          style={[mobileStyles.navItem, { backgroundColor: '#FFEBEE', marginTop: 4 }]}
                          onPress={handleLogout}
                        >
                          <Ionicons name="log-out" size={20} color="#D32F2F" />
                          <Text style={[mobileStyles.navText, { color: '#D32F2F', fontWeight: '700' }]}>Logout / Exit</Text>
                        </TouchableOpacity>
                      );
                    }
                    const active = isCurrentRoute(item.route);
                    return (
                      <TouchableOpacity
                        key={item.route || iIdx}
                        style={[mobileStyles.navItem, active && mobileStyles.navItemActive]}
                        onPress={() => {
                          setMobileDrawerOpen(false);
                          router.push(item.route);
                        }}
                      >
                        <Ionicons name={active ? item.activeIcon : item.icon} size={20} color={active ? Colors.primary : Colors.textSecondary} />
                        <Text style={[mobileStyles.navText, active && mobileStyles.navTextActive]}>{item.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ))}
            </ScrollView>
          </View>
        )}
      </View>
    );
  }

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
            {section.items.map((item, iIdx) => {
              if (item.isLogout) {
                return (
                  <TouchableOpacity
                    key="logout-item-dt"
                    style={[styles.navItem, { backgroundColor: '#FFEBEE', marginTop: 4 }]}
                    onPress={handleLogout}
                    activeOpacity={0.78}
                  >
                    <Ionicons name="log-out" size={20} color="#D32F2F" />
                    {!collapsed && <Text style={[styles.navLabel, { color: '#D32F2F', fontWeight: '700' }]}>Logout</Text>}
                  </TouchableOpacity>
                );
              }
              const active = isCurrentRoute(item.route);
              return (
                <TouchableOpacity key={item.route || iIdx} style={[styles.navItem, active && styles.navItemActive]} onPress={() => router.push(item.route)} activeOpacity={0.78}>
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
      {!collapsed ? (
        <View style={styles.sidebarFooter}>
          <View style={styles.userStatusDot} />
          <View style={{ flex: 1 }}>
            <Text style={styles.userStatusText} numberOfLines={1}>{user?.phone || user?.name || 'Active User'}</Text>
            <Text style={styles.userRoleText}>{role === 'admin' ? 'Admin' : role === 'quarry_owner' ? 'Quarry Owner' : role === 'driver' ? 'Driver' : 'Customer'}</Text>
          </View>
          <TouchableOpacity style={styles.footerLogoutBtn} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={18} color="#D32F2F" />
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity style={[styles.sidebarFooter, { justifyContent: 'center' }]} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={20} color="#D32F2F" />
        </TouchableOpacity>
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
  userStatusText: { fontSize: 12, fontWeight: '700', color: Colors.navy },
  userRoleText: { fontSize: 10, color: Colors.textSecondary },
  footerLogoutBtn: { width: 32, height: 32, borderRadius: 8, backgroundColor: '#FFEBEE', alignItems: 'center', justifyContent: 'center' },
});

const mobileStyles = StyleSheet.create({
  topMobileWrap: { width: '100%', backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.borderLight, zIndex: 999 },
  topMobileBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, height: 56, gap: 12 },
  menuBtn: { width: 38, height: 38, borderRadius: 8, backgroundColor: Colors.background, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.borderLight },
  mobileBrand: { fontSize: 16, fontWeight: '800', color: Colors.navy },
  mobileSub: { fontSize: 11, color: Colors.textSecondary },
  roleSwitchBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.primarySurface, alignItems: 'center', justifyContent: 'center' },
  drawerOverlay: { backgroundColor: Colors.surface, borderTopWidth: 1, borderTopColor: Colors.borderLight, padding: 14, maxHeight: 380 },
  drawerScroll: { flex: 1 },
  sectionHeader: { fontSize: 10, fontWeight: '800', color: Colors.textTertiary, letterSpacing: 1, marginBottom: 8 },
  navItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 12, borderRadius: 8, marginBottom: 4, gap: 12 },
  navItemActive: { backgroundColor: Colors.primarySurface },
  navText: { fontSize: 14, fontWeight: '600', color: Colors.textSecondary },
  navTextActive: { color: Colors.primary, fontWeight: '700' },
});
