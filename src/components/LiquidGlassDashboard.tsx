import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, useWindowDimensions, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

export type DashboardViewMode = 'live' | 'loading' | 'empty' | 'error';
export type NavItemCategory = 'overview' | 'analytics' | 'invoices' | 'customers' | 'settings';

export interface LiquidGlassDashboardProps {
  initialViewMode?: DashboardViewMode;
  userProfile?: {
    name: string;
    role: string;
    avatar?: string;
  };
  onActionClick?: (actionType: string) => void;
}

const MOCK_METRICS = [
  { id: 'm-1', title: 'Total Revenue', value: '₹1,28,450', change: '+14.2%', isPositive: true, period: 'vs last month', icon: 'cash-outline', gradient: ['#10B98133', '#05966911'] },
  { id: 'm-2', title: 'Invoices Processed', value: '1,429', change: '+8.7%', isPositive: true, period: 'vs last month', icon: 'receipt-outline', gradient: ['#6366F133', '#4F46E511'] },
  { id: 'm-3', title: 'Pending Receivables', value: '₹14,210', change: '-3.1%', isPositive: false, period: 'vs last month', icon: 'time-outline', gradient: ['#F59E0B33', '#D9770611'] },
  { id: 'm-4', title: 'Active Quarry Clients', value: '384', change: '+22.4%', isPositive: true, period: 'vs last month', icon: 'people-outline', gradient: ['#06B6D433', '#0891B211'] },
];

const MOCK_ACTIVITIES = [
  { id: 'act-1', clientName: 'Apex Quarry Supplies', amount: '₹12,450', status: 'PAID', date: 'Just now', category: 'Material Delivery' },
  { id: 'act-2', clientName: 'MS Blue Metals Corp', amount: '₹8,920', status: 'PENDING', date: '14 mins ago', category: 'Transport Logistics' },
  { id: 'act-3', clientName: 'Vanguard Infrastructure', amount: '₹34,100', status: 'PAID', date: '2 hours ago', category: 'Crushed Stone Batch #409' },
  { id: 'act-4', clientName: 'Titanium Concrete Ltd', amount: '₹4,300', status: 'FAILED', date: '5 hours ago', category: 'Lorry Rental Fee' },
  { id: 'act-5', clientName: 'Highland Builders', amount: '₹19,850', status: 'PAID', date: 'Yesterday', category: 'Monthly Retainer' },
];

export const LiquidGlassDashboard: React.FC<LiquidGlassDashboardProps> = ({
  initialViewMode = 'live',
  userProfile = {
    name: 'MS Blue Metals & Quarries',
    role: 'Quarry Owner & Admin',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=256&q=80',
  },
  onActionClick,
}) => {
  const [viewMode, setViewMode] = useState<DashboardViewMode>(initialViewMode);
  const { width } = useWindowDimensions();
  const isSmallMobile = width < 500;
  const isTabletOrDesktop = width >= 900;

  return (
    <View style={styles.root}>
      {/* Ambient Radial Shader Background */}
      <LinearGradient
        colors={['#0F172A', '#020617', '#0F172A']}
        style={StyleSheet.absoluteFillObject}
      />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.container, { padding: isSmallMobile ? 12 : 24 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Top Liquid Glass Control Header */}
        <View style={[styles.glassHeader, { padding: isSmallMobile ? 14 : 20 }]}>
          <View style={{ flex: 1, minWidth: 200 }}>
            <View style={styles.badgeRow}>
              <Text style={[styles.headerTitle, { fontSize: isSmallMobile ? 16 : 20 }]} numberOfLines={1}>
                BillForge 2026 Executive OS
              </Text>
              <View style={styles.liveTag}>
                <View style={styles.liveDot} />
                <Text style={styles.liveText}>Realtime Telemetry</Text>
              </View>
            </View>
            <Text style={styles.headerSub} numberOfLines={1}>{userProfile.name} · {userProfile.role}</Text>
          </View>

          {/* Demo State Controller Switcher */}
          <View style={[styles.stateSelector, isSmallMobile && { width: '100%', justifyContent: 'space-between', marginTop: 8 }]}>
            <Text style={styles.stateLabel}>Mode:</Text>
            {(['live', 'loading', 'empty', 'error'] as DashboardViewMode[]).map((mode) => (
              <TouchableOpacity
                key={mode}
                onPress={() => setViewMode(mode)}
                style={[styles.stateBtn, viewMode === mode && styles.stateBtnActive]}
              >
                <Text style={[styles.stateBtnText, viewMode === mode && styles.stateBtnTextActive]}>
                  {mode}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* State 1: LOADING */}
        {viewMode === 'loading' && (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>⚡ Syncing Liquid Telemetry Stream...</Text>
            <View style={[styles.skeletonGrid, isSmallMobile && { flexDirection: 'column' }]}>
              {[1, 2, 3, 4].map((k) => (
                <View key={k} style={styles.skeletonCard} />
              ))}
            </View>
          </View>
        )}

        {/* State 2: EMPTY */}
        {viewMode === 'empty' && (
          <View style={styles.emptyContainer}>
            <Ionicons name="folder-open-outline" size={48} color="#818CF8" />
            <Text style={styles.emptyTitle}>No Transactions Recorded</Text>
            <Text style={styles.emptySub}>Your telemetry database is ready. Create a new bill to begin tracking revenue.</Text>
            <TouchableOpacity style={styles.ctaPrimary} onPress={() => setViewMode('live')}>
              <Text style={styles.ctaPrimaryText}>Load Sample Live Telemetry</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* State 3: ERROR */}
        {viewMode === 'error' && (
          <View style={styles.errorContainer}>
            <Ionicons name="alert-circle-outline" size={48} color="#F43F5E" />
            <Text style={styles.errorTitle}>Connection Timeout (HTTP 504)</Text>
            <Text style={styles.errorSub}>Failed to fetch real-time dispatch data from quarry server.</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={() => setViewMode('live')}>
              <Ionicons name="refresh-outline" size={16} color="#FFF" />
              <Text style={styles.retryBtnText}>Retry Connection</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* State 4: LIVE DASHBOARD */}
        {viewMode === 'live' && (
          <View style={styles.liveContent}>
            {/* Top Stat Cards Grid */}
            <View style={styles.metricsGrid}>
              {MOCK_METRICS.map((m) => (
                <View key={m.id} style={[styles.metricCard, isSmallMobile && { minWidth: '100%' }]}>
                  <LinearGradient colors={m.gradient as [string, string]} style={styles.metricGradient} />
                  <View style={styles.metricHeader}>
                    <Text style={styles.metricTitle}>{m.title}</Text>
                    <View style={styles.iconCircle}>
                      <Ionicons name={m.icon as any} size={18} color="#818CF8" />
                    </View>
                  </View>
                  <Text style={styles.metricValue}>{m.value}</Text>
                  <View style={styles.metricFooter}>
                    <View style={[styles.changeBadge, { backgroundColor: m.isPositive ? '#10B98122' : '#F43F5E22' }]}>
                      <Text style={[styles.changeText, { color: m.isPositive ? '#34D399' : '#FB7185' }]}>{m.change}</Text>
                    </View>
                    <Text style={styles.periodText}>{m.period}</Text>
                  </View>
                </View>
              ))}
            </View>

            {/* Main Visuals & Recent Activity Row */}
            <View style={[styles.mainGrid, { flexDirection: isTabletOrDesktop ? 'row' : 'column' }]}>
              {/* Left Chart Telemetry Card */}
              <View style={styles.chartCard}>
                <View style={[styles.cardHeaderRow, isSmallMobile && { flexDirection: 'column', alignItems: 'flex-start', gap: 10 }]}>
                  <View>
                    <Text style={styles.cardTitle}>Revenue & Dispatch Metrics</Text>
                    <Text style={styles.cardSub}>Monthly billing telemetry</Text>
                  </View>
                  <TouchableOpacity style={styles.newBillBtn} onPress={() => onActionClick?.('create_bill')}>
                    <Ionicons name="add-circle-outline" size={16} color="#FFF" />
                    <Text style={styles.newBillText}>+ New Bill</Text>
                  </TouchableOpacity>
                </View>

                {/* Simulated Visual Telemetry Bars with Horizontal Scroll on Small Screens */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexGrow: 1 }}>
                  <View style={[styles.barChartContainer, { minWidth: isSmallMobile ? 320 : '100%' }]}>
                    {[65, 40, 85, 55, 95, 70, 88, 100, 75, 90, 60, 80].map((h, i) => (
                      <View key={i} style={styles.barWrap}>
                        <LinearGradient
                          colors={i === 7 ? ['#818CF8', '#C084FC'] : ['#334155', '#1E293B']}
                          style={[styles.barItem, { height: `${h}%` }]}
                        />
                        <Text style={styles.barLabel}>{`M${i + 1}`}</Text>
                      </View>
                    ))}
                  </View>
                </ScrollView>
              </View>

              {/* Right Recent Activity Card */}
              <View style={styles.activityCard}>
                <View style={styles.cardHeaderRow}>
                  <Text style={styles.cardTitle}>Recent Activity</Text>
                  <TouchableOpacity onPress={() => onActionClick?.('view_all_transactions')}>
                    <Text style={styles.linkText}>View All</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.activityList}>
                  {MOCK_ACTIVITIES.map((act) => (
                    <View key={act.id} style={styles.activityRow}>
                      <View style={styles.avatarWrap}>
                        <Text style={styles.avatarText}>{act.clientName.substring(0, 2).toUpperCase()}</Text>
                      </View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={styles.actName} numberOfLines={1}>{act.clientName}</Text>
                        <Text style={styles.actSub} numberOfLines={1}>{act.category} · {act.date}</Text>
                      </View>
                      <View style={{ alignItems: 'flex-end', flexShrink: 0 }}>
                        <Text style={styles.actAmount}>{act.amount}</Text>
                        <Text style={[styles.actStatus, { color: act.status === 'PAID' ? '#34D399' : act.status === 'PENDING' ? '#FBBF24' : '#FB7185' }]}>
                          {act.status}
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#020617',
  },
  container: {
    gap: 16,
  },
  glassHeader: {
    borderRadius: 20,
    backgroundColor: 'rgba(30, 41, 59, 0.5)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 12,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  headerTitle: {
    fontWeight: '800',
    color: '#F8FAFC',
    letterSpacing: -0.5,
  },
  liveTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#34D399',
  },
  liveText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#34D399',
  },
  headerSub: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 4,
  },
  stateSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    padding: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  stateLabel: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '700',
    marginLeft: 4,
  },
  stateBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  stateBtnActive: {
    backgroundColor: '#6366F1',
  },
  stateBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#94A3B8',
    textTransform: 'capitalize',
  },
  stateBtnTextActive: {
    color: '#FFFFFF',
  },
  loadingContainer: {
    padding: 30,
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 14,
    color: '#818CF8',
    fontWeight: '700',
  },
  skeletonGrid: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  skeletonCard: {
    flex: 1,
    height: 100,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 16,
  },
  emptyContainer: {
    padding: 36,
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(30, 41, 59, 0.4)',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#F8FAFC',
  },
  emptySub: {
    fontSize: 13,
    color: '#94A3B8',
    textAlign: 'center',
    maxWidth: 400,
  },
  ctaPrimary: {
    backgroundColor: '#6366F1',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
    marginTop: 8,
  },
  ctaPrimaryText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 13,
  },
  errorContainer: {
    padding: 30,
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(159, 18, 57, 0.2)',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(244, 63, 94, 0.3)',
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FECDD3',
  },
  errorSub: {
    fontSize: 12,
    color: '#FDA4AF',
    textAlign: 'center',
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F43F5E',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
  },
  retryBtnText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 12,
  },
  liveContent: {
    gap: 16,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  metricCard: {
    flex: 1,
    minWidth: 200,
    padding: 16,
    borderRadius: 20,
    backgroundColor: 'rgba(30, 41, 59, 0.5)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    overflow: 'hidden',
  },
  metricGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  metricHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  metricTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94A3B8',
    textTransform: 'uppercase',
  },
  iconCircle: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricValue: {
    fontSize: 22,
    fontWeight: '900',
    color: '#F8FAFC',
    letterSpacing: -0.5,
  },
  metricFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  changeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  changeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  periodText: {
    fontSize: 10,
    color: '#64748B',
  },
  mainGrid: {
    gap: 16,
  },
  chartCard: {
    flex: 2,
    padding: 18,
    borderRadius: 24,
    backgroundColor: 'rgba(30, 41, 59, 0.5)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    gap: 16,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#F8FAFC',
  },
  cardSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  newBillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#6366F1',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 12,
  },
  newBillText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 12,
  },
  barChartContainer: {
    height: 160,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingTop: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  barWrap: {
    flex: 1,
    alignItems: 'center',
    height: '100%',
    justifyContent: 'flex-end',
    gap: 6,
  },
  barItem: {
    width: 12,
    borderRadius: 6,
  },
  barLabel: {
    fontSize: 9,
    color: '#64748B',
    fontWeight: '600',
  },
  activityCard: {
    flex: 1,
    padding: 18,
    borderRadius: 24,
    backgroundColor: 'rgba(30, 41, 59, 0.5)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    gap: 14,
  },
  linkText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#818CF8',
  },
  activityList: {
    gap: 10,
  },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
  },
  avatarWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#818CF8',
  },
  actName: {
    fontSize: 12,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  actSub: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 2,
  },
  actAmount: {
    fontSize: 12,
    fontWeight: '800',
    color: '#F8FAFC',
  },
  actStatus: {
    fontSize: 9,
    fontWeight: '800',
    marginTop: 2,
  },
});

export default LiquidGlassDashboard;
