// @ts-nocheck
import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius } from '../src/theme';
import { Card } from '../src/components';

const STEPS = [
  {
    icon: 'create-outline',
    title: 'Create & Save a Bill',
    desc: 'Fill in the party name, customer phone, line items, and tap "Save Bill" or "Save & Share on WhatsApp".',
  },
  {
    icon: 'document-text-outline',
    title: 'PDF is Auto-Generated',
    desc: 'Your bill is converted to a PDF instantly — no server needed. All processing happens on your device.',
  },
  {
    icon: 'logo-whatsapp',
    title: 'WhatsApp Opens Automatically',
    desc: 'Your device\'s WhatsApp opens with the customer\'s phone number pre-filled. Tap Send — done!',
  },
  {
    icon: 'people-outline',
    title: 'Ledger Statements from Customers',
    desc: 'Go to Customers tab → tap the WhatsApp icon → the full ledger statement is pre-typed and ready to send.',
  },
];

const FEATURES = [
  { icon: 'server-outline', label: 'No server setup required', color: '#16A34A' },
  { icon: 'wifi-outline', label: 'Works fully offline', color: '#2563EB' },
  { icon: 'shield-checkmark-outline', label: 'No WhatsApp credentials stored', color: '#7C3AED' },
  { icon: 'flash-outline', label: 'Instant — opens WhatsApp in 1 tap', color: '#D97706' },
];

export default function WhatsappSettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>WhatsApp Sharing</Text>
          <Text style={styles.headerSub}>Serverless — No setup required</Text>
        </View>
        <View style={styles.waBadge}>
          <Ionicons name="logo-whatsapp" size={20} color="#FFF" />
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Hero Card */}
        <View style={styles.heroCard}>
          <View style={styles.heroIconRow}>
            <View style={styles.heroIconCircle}>
              <Ionicons name="logo-whatsapp" size={36} color="#FFF" />
            </View>
          </View>
          <Text style={styles.heroTitle}>Zero Server. Zero Setup.</Text>
          <Text style={styles.heroSub}>
            BillForge uses WhatsApp Deep Links to open WhatsApp directly on your device with the bill details and customer number pre-filled.
            You just tap <Text style={{ fontWeight: 'bold' }}>Send</Text> — that's it.
          </Text>
        </View>

        {/* Features */}
        <View style={styles.featuresRow}>
          {FEATURES.map((f, i) => (
            <View key={i} style={styles.featureChip}>
              <Ionicons name={f.icon} size={16} color={f.color} />
              <Text style={styles.featureText}>{f.label}</Text>
            </View>
          ))}
        </View>

        {/* How it works */}
        <Card style={styles.stepsCard}>
          <Text style={styles.stepsTitle}>📲 How it works</Text>
          {STEPS.map((step, i) => (
            <View key={i} style={styles.stepRow}>
              <View style={styles.stepNumCircle}>
                <Text style={styles.stepNum}>{i + 1}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                  <Ionicons name={step.icon} size={15} color={Colors.primary} />
                  <Text style={styles.stepTitle}>{step.title}</Text>
                </View>
                <Text style={styles.stepDesc}>{step.desc}</Text>
              </View>
            </View>
          ))}
        </Card>

        {/* Quick Actions */}
        <Card style={styles.actionsCard}>
          <Text style={styles.stepsTitle}>⚡ Quick Actions</Text>
          <TouchableOpacity style={styles.actionBtn} onPress={() => router.push('/(tabs)/create-bill')}>
            <Ionicons name="add-circle-outline" size={20} color={Colors.primary} />
            <Text style={styles.actionBtnText}>Create a Bill & Share</Text>
            <Ionicons name="chevron-forward" size={16} color={Colors.textTertiary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={() => router.push('/customers')}>
            <Ionicons name="people-outline" size={20} color="#8B3FC8" />
            <Text style={styles.actionBtnText}>Send Ledger to Customer</Text>
            <Ionicons name="chevron-forward" size={16} color={Colors.textTertiary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => Linking.openURL('https://wa.me/')}
          >
            <Ionicons name="logo-whatsapp" size={20} color="#25D366" />
            <Text style={styles.actionBtnText}>Test WhatsApp on this Device</Text>
            <Ionicons name="chevron-forward" size={16} color={Colors.textTertiary} />
          </TouchableOpacity>
        </Card>

        {/* Note */}
        <View style={styles.noteCard}>
          <Ionicons name="information-circle-outline" size={18} color={Colors.primary} style={{ marginTop: 1 }} />
          <Text style={styles.noteText}>
            WhatsApp must be installed on this device. The app opens WhatsApp using the official{' '}
            <Text style={{ fontWeight: 'bold' }}>wa.me</Text> link protocol — no passwords, no login, no server.
          </Text>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  backBtn: { padding: Spacing.xs },
  headerTitle: { ...Typography.h2, color: Colors.text },
  headerSub: { ...Typography.caption, color: Colors.textSecondary },
  waBadge: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#25D366',
    alignItems: 'center', justifyContent: 'center',
  },
  content: { padding: Spacing.lg },
  heroCard: {
    backgroundColor: '#F0F9F4',
    borderWidth: 1.5,
    borderColor: '#86EFAC',
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    marginBottom: Spacing.md,
    alignItems: 'center',
  },
  heroIconRow: { marginBottom: Spacing.md },
  heroIconCircle: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: '#25D366',
    alignItems: 'center', justifyContent: 'center',
  },
  heroTitle: { ...Typography.h2, color: '#166534', textAlign: 'center', marginBottom: 8 },
  heroSub: { ...Typography.body, color: Colors.textSecondary, textAlign: 'center', lineHeight: 22 },
  featuresRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: Spacing.md },
  featureChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.surface,
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: BorderRadius.sm,
    borderWidth: 1, borderColor: Colors.borderLight,
  },
  featureText: { ...Typography.caption, color: Colors.text },
  stepsCard: { padding: Spacing.lg, marginBottom: Spacing.md },
  stepsTitle: { ...Typography.bodyLargeBold, color: Colors.text, marginBottom: Spacing.md },
  stepRow: {
    flexDirection: 'row', gap: 12, alignItems: 'flex-start',
    marginBottom: Spacing.md,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1, borderBottomColor: Colors.borderLight,
  },
  stepNumCircle: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center',
    marginTop: 2,
  },
  stepNum: { color: '#FFF', fontSize: 12, fontWeight: 'bold' },
  stepTitle: { ...Typography.captionSemibold, color: Colors.text },
  stepDesc: { ...Typography.caption, color: Colors.textSecondary, lineHeight: 18, marginTop: 2 },
  actionsCard: { padding: Spacing.lg, marginBottom: Spacing.md },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1, borderBottomColor: Colors.borderLight,
  },
  actionBtnText: { ...Typography.bodyMedium, color: Colors.text, flex: 1 },
  noteCard: {
    flexDirection: 'row', gap: 8,
    backgroundColor: Colors.primarySurface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    borderWidth: 1, borderColor: Colors.accent + '40',
  },
  noteText: { ...Typography.caption, color: Colors.textSecondary, flex: 1, lineHeight: 18 },
});
