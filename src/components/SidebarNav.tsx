// @ts-nocheck
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
} from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../theme';
import { useAuth } from '../context/AuthContext';

const NAV_SECTIONS = [
  {
    title: 'BILLING & INVOICING',
    items: [
      { route: '/(tabs)', icon: 'grid-outline', activeIcon: 'grid', label: 'Dashboard' },
      { route: '/bill-form/1', icon: 'add-circle-outline', activeIcon: 'add-circle', label: 'New Bill Generator' },
      { route: '/(tabs)/templates', icon: 'document-text-outline', activeIcon: 'document-text', label: 'Bill Templates' },
      { route: '/(tabs)/history', icon: 'receipt-outline', activeIcon: 'receipt', label: 'Bills Maintenance' },
      { route: '/(tabs)/materials', icon: 'cube-outline', activeIcon: 'cube', label: 'Material Catalog & Rates' },
    ],
  },
  {
    title: 'QUARRY OPERATIONS & SUPPLY CHAIN',
    items: [
      { route: '/customers', icon: 'people-outline', activeIcon: 'people', label: 'Customer Directory' },
      { route: '/drivers', icon: 'car-sport-outline', activeIcon: 'car-sport', label: 'Lorry Drivers & Transport' },
      { route: '/enquiries', icon: 'chatbubbles-outline', activeIcon: 'chatbubbles', label: 'Customer Enquiries' },
      { route: '/ledger', icon: 'book-outline', activeIcon: 'book', label: 'Customer & Material Ledger' },
      { route: '/live-tracking', icon: 'map-outline', activeIcon: 'map', label: 'Live Delivery Radar' },
      { route: '/reminders', icon: 'time-outline', activeIcon: 'time', label: 'Payment Reminders' },
    ],
  },
  {
    title: 'SETTINGS & ACCOUNT',
    items: [
      { route: '/(tabs)/profile', icon: 'business-outline', activeIcon: 'business', label: 'Company Profile' },
      { route: '/select-role', icon: 'swap-horizontal-outline', activeIcon: 'swap-horizontal', label: 'Switch Portal / Logout' },
    ],
  },
];

export function SidebarNav() {
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useAuth();
  const [collapsed, setCollapsed] = useState(false);

  const isCurrentRoute = (r: string) => {
    if (r === '/(tabs)' && (pathname === '/' || pathname === '/(tabs)' || pathname === '/(tabs)/index')) return true;
    if (r === '/bill-form/1' && pathname.includes('/bill-form')) return true;
    return pathname.startsWith(r);
  };

  const companyName = user?.name || 'Sri Murugan Quarry';

  return (
    <View style={[styles.sidebar, collapsed && styles.sidebarCollapsed]}>
      {/* Header / Brand */}
      <View style={styles.brandHeader}>
        <View style={styles.logoWrap}>
          <Ionicons name="layers" size={22} color="#FFF" />
        </View>
        {!collapsed && (
          <View style={styles.brandTextWrap}>
            <Text style={styles.appName}>BillForge</Text>
            <Text style={styles.companySub} numberOfLines={1}>{companyName}</Text>
          </View>
        )}
        <TouchableOpacity
          style={styles.collapseToggle}
          onPress={() => setCollapsed(!collapsed)}
          activeOpacity={0.7}
        >
          <Ionicons
            name={collapsed ? 'chevron-forward' : 'chevron-back'}
            size={18}
            color={Colors.textSecondary}
          />
        </TouchableOpacity>
      </View>

      {/* Nav List */}
      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {NAV_SECTIONS.map((section, sIdx) => (
          <View key={section.title || sIdx} style={styles.sectionWrap}>
            {!collapsed && (
              <Text style={styles.sectionHeader}>{section.title}</Text>
            )}
            {section.items.map((item) => {
              const active = isCurrentRoute(item.route);
              return (
                <TouchableOpacity
                  key={item.route}
                  style={[styles.navItem, active && styles.navItemActive]}
                  onPress={() => router.push(item.route)}
                  activeOpacity={0.78}
                >
                  <View style={[styles.navIconBox, active && styles.navIconBoxActive]}>
                    <Ionicons
                      name={active ? item.activeIcon : item.icon}
                      size={20}
                      color={active ? Colors.primary : Colors.textSecondary}
                    />
                  </View>
                  {!collapsed && (
                    <Text style={[styles.navLabel, active && styles.navLabelActive]} numberOfLines={1}>
                      {item.label}
                    </Text>
                  )}
                  {active && !collapsed && (
                    <View style={styles.activeDot} />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        ))}
      </ScrollView>

      {/* Footer Profile Status */}
      {!collapsed && (
        <View style={styles.sidebarFooter}>
          <View style={styles.userStatusDot} />
          <View style={{ flex: 1 }}>
            <Text style={styles.userStatusText} numberOfLines={1}>{user?.phone || 'Online Quarry Owner'}</Text>
            <Text style={styles.userRoleText}>Active Session</Text>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  sidebar: {
    width: 240,
    backgroundColor: Colors.surface,
    borderRightWidth: 1,
    borderRightColor: Colors.borderLight,
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    shadowColor: Colors.shadow,
    shadowOffset: { width: 3, height: 0 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 4,
    zIndex: 100,
  },
  sidebarCollapsed: {
    width: 72,
  },
  brandHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
    gap: 12,
  },
  logoWrap: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandTextWrap: {
    flex: 1,
  },
  appName: {
    fontSize: 17,
    fontWeight: '800',
    color: Colors.navy,
    letterSpacing: -0.4,
  },
  companySub: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 1,
  },
  collapseToggle: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  scroll: {
    flex: 1,
    paddingTop: 12,
  },
  sectionWrap: {
    marginBottom: 18,
    paddingHorizontal: 12,
  },
  sectionHeader: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.textTertiary,
    letterSpacing: 1.1,
    marginBottom: 8,
    paddingHorizontal: 8,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderRadius: 10,
    marginBottom: 3,
    gap: 12,
  },
  navItemActive: {
    backgroundColor: Colors.primarySurface,
  },
  navIconBox: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navIconBoxActive: {},
  navLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
    flex: 1,
  },
  navLabelActive: {
    color: Colors.primary,
    fontWeight: '700',
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.primary,
  },
  sidebarFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
    backgroundColor: Colors.background,
    gap: 10,
  },
  userStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.success,
  },
  userStatusText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.text,
  },
  userRoleText: {
    fontSize: 10,
    color: Colors.textTertiary,
  },
});
