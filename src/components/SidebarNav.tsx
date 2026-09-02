// @ts-nocheck
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Modal, TouchableWithoutFeedback, useWindowDimensions,
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
    { route: '/profile', icon: 'person-circle-outline', activeIcon: 'person-circle', label: 'Profile & Settings' },
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
    { route: '/profile', icon: 'person-circle-outline', activeIcon: 'person-circle', label: 'Profile & Settings' },
    { route: '/whatsapp-settings', icon: 'logo-whatsapp', activeIcon: 'logo-whatsapp', label: 'WhatsApp Integration' },
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
    { route: '/profile', icon: 'person-circle-outline', activeIcon: 'person-circle', label: 'Profile & Settings' },
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
    { route: '/profile', icon: 'person-circle-outline', activeIcon: 'person-circle', label: 'Profile & Settings' },
    { route: '/select-role', icon: 'swap-horizontal-outline', activeIcon: 'swap-horizontal', label: 'Switch Portal' },
    { isLogout: true, icon: 'log-out-outline', activeIcon: 'log-out', label: 'Logout' },
  ]},
];

export function SidebarNav() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, role, logout } = useAuth();
  const { width } = useWindowDimensions();
  const isMobile = width < 768;

  const [collapsed, setCollapsed] = useState(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  // Hide sidebar whenever NO user is logged in
  if (!user) {
    return null;
  }

  // Hide on auth / role-selection screens
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

  // On mobile, hide the top navbar on full-screen task flows (like bill creation & preview)
  // so the screen isn't crowded with two headers!
  const isDedicatedFlow = pathname.includes('/bill-form') ||
    pathname.includes('/bill-preview') ||
    pathname.includes('/template-detail');

  if (isMobile && isDedicatedFlow) {
    return null;
  }

  const handleLogout = () => {
    logout();
    setMobileDrawerOpen(false);
    if (typeof window !== 'undefined' && window.location) {
      window.location.href = '/select-role';
    } else {
      router.replace('/select-role');
    }
  };

  const currentRole = user?.role || role;

  const navSections = currentRole === 'admin' ? ADMIN_NAV
    : currentRole === 'driver' ? DRIVER_NAV
    : currentRole === 'customer' ? CUSTOMER_NAV
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
    : (user?.name || user?.owner_name || user?.company_name || 'Quarry Owner');

  // ─── Mobile View: Compact Bar + Slide-Out Modal Drawer ───
  if (isMobile) {
    return (
      <>
        {/* Compact Mobile Top Bar */}
        <View style={mobileStyles.topMobileBar}>
          <TouchableOpacity
            style={mobileStyles.menuBtn}
            onPress={() => setMobileDrawerOpen(true)}
            activeOpacity={0.7}
          >
            <Ionicons name="menu-outline" size={22} color={Colors.text} />
          </TouchableOpacity>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={mobileStyles.mobileBrand} numberOfLines={1}>{brandName}</Text>
            <Text style={mobileStyles.mobileSub} numberOfLines={1}>{subLabel}</Text>
          </View>
          <TouchableOpacity
            style={mobileStyles.roleSwitchBtn}
            onPress={() => router.push('/select-role')}
            activeOpacity={0.7}
          >
            <Ionicons name="swap-horizontal" size={18} color={Colors.primary} />
          </TouchableOpacity>
        </View>

        {/* Floating Slide-Over Drawer Modal */}
        <Modal
          visible={mobileDrawerOpen}
          animationType="fade"
          transparent={true}
          onRequestClose={() => setMobileDrawerOpen(false)}
        >
          <View style={mobileStyles.modalOverlay}>
            {/* Backdrop Tap to Close */}
            <TouchableWithoutFeedback onPress={() => setMobileDrawerOpen(false)}>
              <View style={mobileStyles.backdropTouchable} />
            </TouchableWithoutFeedback>

            {/* Left Slide-Out Drawer Panel */}
            <View style={mobileStyles.drawerPanel}>
              {/* Drawer Header */}
              <View style={mobileStyles.drawerHeader}>
                <View style={[mobileStyles.logoWrap, role === 'admin' && { backgroundColor: Colors.warning }, role === 'driver' && { backgroundColor: Colors.info }, role === 'customer' && { backgroundColor: Colors.success }]}>
                  <Ionicons name={role === 'admin' ? 'shield' : role === 'driver' ? 'car-sport' : role === 'customer' ? 'storefront' : 'layers'} size={20} color="#FFF" />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={mobileStyles.drawerBrand}>{brandName}</Text>
                  <Text style={mobileStyles.drawerSub} numberOfLines={1}>{subLabel}</Text>
                </View>
                <TouchableOpacity
                  style={mobileStyles.closeBtn}
                  onPress={() => setMobileDrawerOpen(false)}
                >
                  <Ionicons name="close" size={22} color={Colors.text} />
                </TouchableOpacity>
              </View>

              {/* Navigation Items List */}
              <ScrollView style={mobileStyles.drawerScroll} showsVerticalScrollIndicator={false}>
                {navSections.map((section, sIdx) => (
                  <View key={section.title || sIdx} style={{ marginBottom: 16 }}>
                    <Text style={mobileStyles.sectionHeader}>{section.title}</Text>
                    {section.items.map((item, iIdx) => {
                      if (item.isLogout) {
                        return (
                          <TouchableOpacity
                            key="logout-item-mob"
                            style={mobileStyles.logoutItem}
                            onPress={handleLogout}
                          >
                            <Ionicons name="log-out-outline" size={18} color={Colors.danger} />
                            <Text style={mobileStyles.logoutText}>Logout / Exit</Text>
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
                          <Ionicons
                            name={active ? item.activeIcon : item.icon}
                            size={19}
                            color={active ? Colors.primary : Colors.textSecondary}
                          />
                          <Text style={[mobileStyles.navText, active && mobileStyles.navTextActive]}>
                            {item.label}
                          </Text>
                          {active && <View style={mobileStyles.activeDot} />}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                ))}
                <View style={{ height: 20 }} />
              </ScrollView>

              {/* Drawer Footer */}
              <View style={mobileStyles.drawerFooter}>
                <View style={mobileStyles.userStatusDot} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={mobileStyles.userStatusText} numberOfLines={1}>{user?.phone || user?.name || 'Active User'}</Text>
                  <Text style={mobileStyles.userRoleText}>{role === 'admin' ? 'Admin' : role === 'quarry_owner' ? 'Quarry Owner' : role === 'driver' ? 'Driver' : 'Customer'}</Text>
                </View>
                <TouchableOpacity style={mobileStyles.footerLogoutBtn} onPress={handleLogout}>
                  <Ionicons name="log-out-outline" size={18} color={Colors.danger} />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </>
    );
  }

  // ─── Desktop Left Sidebar ───
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
                    style={[styles.navItem, { backgroundColor: 'rgba(244, 63, 94, 0.12)', marginTop: 4 }]}
                    onPress={handleLogout}
                    activeOpacity={0.78}
                  >
                    <Ionicons name="log-out" size={19} color={Colors.danger} />
                    {!collapsed && <Text style={[styles.navLabel, { color: Colors.danger, fontWeight: '700' }]}>Logout</Text>}
                  </TouchableOpacity>
                );
              }
              const active = isCurrentRoute(item.route);
              return (
                <TouchableOpacity key={item.route || iIdx} style={[styles.navItem, active && styles.navItemActive]} onPress={() => router.push(item.route)} activeOpacity={0.78}>
                  <Ionicons name={active ? item.activeIcon : item.icon} size={19} color={active ? '#818CF8' : '#94A3B8'} />
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
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.userStatusText} numberOfLines={1}>{user?.phone || user?.name || 'Active User'}</Text>
            <Text style={styles.userRoleText}>{role === 'admin' ? 'Admin' : role === 'quarry_owner' ? 'Quarry Owner' : role === 'driver' ? 'Driver' : 'Customer'}</Text>
          </View>
          <TouchableOpacity style={styles.footerLogoutBtn} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={18} color={Colors.danger} />
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity style={[styles.sidebarFooter, { justifyContent: 'center' }]} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={20} color={Colors.danger} />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  sidebar: { width: 240, backgroundColor: '#0F172A', borderRightWidth: 1, borderRightColor: '#1E293B', height: '100%', flexDirection: 'column', zIndex: 100 },
  sidebarCollapsed: { width: 64 },
  brandHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#1E293B', gap: 10 },
  logoWrap: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#6366F1', alignItems: 'center', justifyContent: 'center' },
  brandTextWrap: { flex: 1 },
  appName: { fontSize: 16, fontWeight: '800', color: '#F8FAFC', letterSpacing: -0.3 },
  companySub: { fontSize: 11, color: '#94A3B8', marginTop: 1 },
  collapseToggle: { width: 26, height: 26, borderRadius: 7, backgroundColor: '#1E293B', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.1)' },
  scroll: { flex: 1, paddingTop: 10 },
  sectionWrap: { marginBottom: 16, paddingHorizontal: 10 },
  sectionHeader: { fontSize: 10, fontWeight: '700', color: '#64748B', letterSpacing: 1, marginBottom: 6, paddingHorizontal: 8 },
  navItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 10, borderRadius: 8, marginBottom: 2, gap: 10 },
  navItemActive: { backgroundColor: 'rgba(99, 102, 241, 0.15)', borderWidth: 1, borderColor: 'rgba(99, 102, 241, 0.3)' },
  navLabel: { fontSize: 13, fontWeight: '600', color: '#94A3B8', flex: 1 },
  navLabelActive: { color: '#818CF8', fontWeight: '700' },
  activeDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#818CF8' },
  sidebarFooter: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12, borderTopWidth: 1, borderTopColor: '#1E293B', backgroundColor: '#0B0F19', gap: 8 },
  userStatusDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#34D399' },
  userStatusText: { fontSize: 12, fontWeight: '700', color: '#F8FAFC' },
  userRoleText: { fontSize: 10, color: '#94A3B8' },
  footerLogoutBtn: { width: 32, height: 32, borderRadius: 8, backgroundColor: 'rgba(244, 63, 94, 0.15)', alignItems: 'center', justifyContent: 'center' },
});

const mobileStyles = StyleSheet.create({
  topMobileBar: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, height: 52, gap: 10,
    backgroundColor: '#0F172A',
    borderBottomWidth: 1, borderBottomColor: '#1E293B',
  },
  menuBtn: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: '#1E293B', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  mobileBrand: { fontSize: 15, fontWeight: '800', color: '#F8FAFC' },
  mobileSub: { fontSize: 11, color: '#94A3B8' },
  roleSwitchBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    alignItems: 'center', justifyContent: 'center',
  },

  // Floating Drawer Overlay
  modalOverlay: {
    flex: 1, flexDirection: 'row',
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
  },
  backdropTouchable: {
    position: 'absolute', top: 0, bottom: 0, left: 0, right: 0,
  },
  drawerPanel: {
    width: 290, maxWidth: '82%', height: '100%',
    backgroundColor: '#0F172A',
    borderRightWidth: 1, borderRightColor: '#1E293B',
    shadowColor: '#000', shadowOffset: { width: 4, height: 0 }, shadowOpacity: 0.5, shadowRadius: 16,
    elevation: 24,
    zIndex: 9999,
  },
  drawerHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 16, paddingVertical: 18,
    borderBottomWidth: 1, borderBottomColor: '#1E293B',
    backgroundColor: '#0B0F19',
  },
  logoWrap: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: '#6366F1', alignItems: 'center', justifyContent: 'center',
  },
  drawerBrand: { fontSize: 16, fontWeight: '800', color: '#F8FAFC' },
  drawerSub: { fontSize: 11, color: '#94A3B8', marginTop: 1 },
  closeBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: '#1E293B', alignItems: 'center', justifyContent: 'center',
  },
  drawerScroll: { flex: 1, paddingHorizontal: 12, paddingTop: 14 },
  sectionHeader: {
    fontSize: 10, fontWeight: '800', color: '#64748B',
    letterSpacing: 1, marginBottom: 8, paddingHorizontal: 8,
  },
  navItem: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10,
    marginBottom: 4, gap: 12,
  },
  navItemActive: {
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    borderWidth: 1, borderColor: 'rgba(99, 102, 241, 0.3)',
  },
  navText: { fontSize: 14, fontWeight: '600', color: '#94A3B8', flex: 1 },
  navTextActive: { color: '#818CF8', fontWeight: '700' },
  activeDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#818CF8' },

  logoutItem: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: 'rgba(244, 63, 94, 0.12)',
    paddingVertical: 10, paddingHorizontal: 12,
    borderRadius: 10, marginTop: 4,
  },
  logoutText: { fontSize: 13, fontWeight: '700', color: Colors.danger },

  drawerFooter: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 16, paddingVertical: 14,
    borderTopWidth: 1, borderTopColor: '#1E293B',
    backgroundColor: '#0B0F19',
  },
  userStatusDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#34D399' },
  userStatusText: { fontSize: 12, fontWeight: '700', color: '#F8FAFC' },
  userRoleText: { fontSize: 10, color: '#94A3B8' },
  footerLogoutBtn: {
    width: 32, height: 32, borderRadius: 8,
    backgroundColor: 'rgba(244, 63, 94, 0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
});
