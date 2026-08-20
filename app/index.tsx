// @ts-nocheck
import React from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar, Dimensions, Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../src/theme';

const { width: W } = Dimensions.get('window');

export default function LandingPageScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" />
      
      {/* Top Navbar */}
      <View style={styles.navbar}>
        <View style={styles.brandRow}>
          <View style={styles.logoWrap}>
            <Ionicons name="layers" size={22} color="#FFF" />
          </View>
          <Text style={styles.brandName}>BillForge</Text>
          <View style={styles.versionBadge}>
            <Text style={styles.versionText}>Enterprise</Text>
          </View>
        </View>

        <View style={styles.navActions}>
          <TouchableOpacity style={styles.navBtnOutline} onPress={() => router.push('/admin-portal')}>
            <Ionicons name="shield-checkmark-outline" size={16} color={Colors.navy} />
            <Text style={styles.navBtnOutlineText}>Admin Tower</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.navBtnPrimary} onPress={() => router.push('/select-role')}>
            <Text style={styles.navBtnPrimaryText}>Launch Portals</Text>
            <Ionicons name="arrow-forward" size={16} color="#FFF" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={{ paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
        {/* Hero Section */}
        <View style={styles.heroSection}>
          <View style={styles.heroContent}>
            <View style={styles.tagPill}>
              <Ionicons name="sparkles" size={14} color={Colors.primary} />
              <Text style={styles.tagPillText}>Next-Gen Quarry Operations & Billing Platform</Text>
            </View>

            <Text style={styles.heroTitle}>
              End-to-End Quarry Management, <Text style={{ color: Colors.primary }}>Customized Word Invoices</Text> & Lorry Dispatch
            </Text>

            <Text style={styles.heroSub}>
              Streamline material pricing, automated sequential billing, customer dues ledgers, live negotiation chats, per-kilometer transport rate cards, and eWay bill legal compliance.
            </Text>

            {/* CTA Buttons */}
            <View style={styles.heroCtaRow}>
              <TouchableOpacity style={styles.ctaPrimary} onPress={() => router.push('/owner-register')} activeOpacity={0.8}>
                <Ionicons name="business" size={20} color="#FFF" />
                <Text style={styles.ctaPrimaryText}>Register Your Quarry Business</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.ctaSecondary} onPress={() => router.push('/select-role')} activeOpacity={0.8}>
                <Ionicons name="open-outline" size={20} color={Colors.navy} />
                <Text style={styles.ctaSecondaryText}>Access Portals</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Feature Grid */}
        <View style={styles.sectionWrap}>
          <Text style={styles.sectionTag}>CAPABILITIES & MODULES</Text>
          <Text style={styles.sectionHeader}>Everything Your Quarry Needs in One Serverless Platform</Text>

          <View style={styles.grid}>
            {/* Feature 1 */}
            <View style={styles.featureCard}>
              <View style={[styles.featIconWrap, { backgroundColor: '#EBF5FB' }]}>
                <Ionicons name="document-text" size={26} color={Colors.primary} />
              </View>
              <Text style={styles.featTitle}>Customized Word (.docx) Invoices</Text>
              <Text style={styles.featDesc}>Upload sample Word templates (`.docx`). Generate print-ready bills with auto sequential serial numbers (`0001`, `0002`...) and auto unit calculation.</Text>
            </View>

            {/* Feature 2 */}
            <View style={styles.featureCard}>
              <View style={[styles.featIconWrap, { backgroundColor: '#FEF3C7' }]}>
                <Ionicons name="save" size={26} color="#D97706" />
              </View>
              <Text style={styles.featTitle}>Auto-Resume & Minimized Taskbar</Text>
              <Text style={styles.featDesc}>Never lose progress on unsaved bills. Minimize active drafts to a Windows-style bottom taskbar pill and resume seamlessly anytime.</Text>
            </View>

            {/* Feature 3 */}
            <View style={styles.featureCard}>
              <View style={[styles.featIconWrap, { backgroundColor: '#E8F5E9' }]}>
                <Ionicons name="storefront" size={26} color="#2E7D32" />
              </View>
              <Text style={styles.featTitle}>Customer Marketplace & Live Chat</Text>
              <Text style={styles.featDesc}>Showcase live material rates (River Sand, M-Sand, Blue Metal) across quarries. Direct live chat window for customer-quarry price negotiations.</Text>
            </View>

            {/* Feature 4 */}
            <View style={styles.featureCard}>
              <View style={[styles.featIconWrap, { backgroundColor: '#E3F2FD' }]}>
                <Ionicons name="car-sport" size={26} color="#1565C0" />
              </View>
              <Text style={styles.featTitle}>Transport & Per-KM Rate Cards</Text>
              <Text style={styles.featDesc}>Assign own or hired lorries. Drivers configure custom rate cards per kilometer (₹/km), minimum trip charges, loading & waiting fees.</Text>
            </View>

            {/* Feature 5 */}
            <View style={styles.featureCard}>
              <View style={[styles.featIconWrap, { backgroundColor: '#F3E8FF' }]}>
                <Ionicons name="document-attach" size={26} color="#7E22CE" />
              </View>
              <Text style={styles.featTitle}>Legal Transport eWay Bills</Text>
              <Text style={styles.featDesc}>Quarry owners attach official eWay bills and Gate Passes to consignment orders. Drivers inspect legal transport documents directly on their phones.</Text>
            </View>

            {/* Feature 6 */}
            <View style={styles.featureCard}>
              <View style={[styles.featIconWrap, { backgroundColor: '#FFF3E0' }]}>
                <Ionicons name="shield-checkmark" size={26} color="#E65100" />
              </View>
              <Text style={styles.featTitle}>Admin Approval & Security Tower</Text>
              <Text style={styles.featDesc}>Admin approves new business registrations before portal activation. Developer admin reset temporary passwords to unlock lost accounts.</Text>
            </View>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerBrand}>BillForge Quarry Operations System</Text>
          <Text style={styles.footerSub}>100% Serverless & Offline-Capable Client-Side Platform</Text>
          <View style={styles.footerLinks}>
            <TouchableOpacity onPress={() => router.push('/owner-register')}><Text style={styles.footerLinkText}>Register Business</Text></TouchableOpacity>
            <Text style={styles.dot}>•</Text>
            <TouchableOpacity onPress={() => router.push('/select-role')}><Text style={styles.footerLinkText}>Portal Hub</Text></TouchableOpacity>
            <Text style={styles.dot}>•</Text>
            <TouchableOpacity onPress={() => router.push('/admin-portal')}><Text style={styles.footerLinkText}>Admin Tower</Text></TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F8FAFC' },
  navbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logoWrap: { width: 36, height: 36, borderRadius: 10, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  brandName: { fontSize: 20, fontWeight: '900', color: Colors.navy, letterSpacing: -0.5 },
  versionBadge: { backgroundColor: Colors.primarySurface, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  versionText: { fontSize: 10, fontWeight: '700', color: Colors.primary },
  navActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  navBtnOutline: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: Colors.border },
  navBtnOutlineText: { fontSize: 13, fontWeight: '600', color: Colors.navy },
  navBtnPrimary: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, backgroundColor: Colors.primary },
  navBtnPrimaryText: { fontSize: 13, fontWeight: '700', color: '#FFF' },
  scroll: { flex: 1 },
  heroSection: { paddingHorizontal: 20, paddingTop: 40, paddingBottom: 40, alignItems: 'center' },
  heroContent: { maxWidth: 800, width: '100%', alignItems: 'center' },
  tagPill: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.primarySurface, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, marginBottom: 16 },
  tagPillText: { fontSize: 12, fontWeight: '700', color: Colors.primary },
  heroTitle: { fontSize: 36, fontWeight: '900', color: Colors.navy, textAlign: 'center', lineHeight: 46, letterSpacing: -0.8 },
  heroSub: { fontSize: 15, color: Colors.textSecondary, textAlign: 'center', marginTop: 16, lineHeight: 24, maxWidth: 640 },
  heroCtaRow: { flexDirection: 'row', gap: 14, marginTop: 28, flexWrap: 'wrap', justifyContent: 'center' },
  ctaPrimary: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.primary, paddingHorizontal: 22, paddingVertical: 14, borderRadius: 12, shadowColor: Colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 4 },
  ctaPrimaryText: { fontSize: 15, fontWeight: '700', color: '#FFF' },
  ctaSecondary: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.surface, paddingHorizontal: 22, paddingVertical: 14, borderRadius: 12, borderWidth: 1.5, borderColor: Colors.border },
  ctaSecondaryText: { fontSize: 15, fontWeight: '700', color: Colors.navy },
  sectionWrap: { paddingHorizontal: 20, paddingTop: 30, maxWidth: 1100, width: '100%', alignSelf: 'center' },
  sectionTag: { fontSize: 11, fontWeight: '700', color: Colors.textTertiary, textTransform: 'uppercase', letterSpacing: 1.2, textAlign: 'center' },
  sectionHeader: { fontSize: 24, fontWeight: '800', color: Colors.navy, textAlign: 'center', marginTop: 6, marginBottom: 28 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, justifyContent: 'center' },
  featureCard: { width: Platform.OS === 'web' ? 'calc(33.333% - 12px)' : '100%', minWidth: 280, maxWidth: 360, backgroundColor: Colors.surface, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: Colors.borderLight, gap: 10 },
  featIconWrap: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  featTitle: { fontSize: 16, fontWeight: '700', color: Colors.navy },
  featDesc: { fontSize: 13, color: Colors.textSecondary, lineHeight: 19 },
  footer: { marginTop: 50, paddingVertical: 30, paddingHorizontal: 20, backgroundColor: Colors.surface, borderTopWidth: 1, borderTopColor: Colors.borderLight, alignItems: 'center', gap: 8 },
  footerBrand: { fontSize: 15, fontWeight: '800', color: Colors.navy },
  footerSub: { fontSize: 12, color: Colors.textSecondary },
  footerLinks: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 },
  footerLinkText: { fontSize: 13, fontWeight: '600', color: Colors.primary },
  dot: { color: Colors.textTertiary },
});
