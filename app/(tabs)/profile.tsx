// @ts-nocheck
import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius } from '../../src/theme';
import { Card, Button, Input } from '../../src/components';
import { getDatabase, getCompanyProfile, saveCompanyProfile } from '../../src/database/db';

import { useAuth } from '../../src/context/AuthContext';
import { useToast } from '../../src/context/ToastContext';

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { quarryId, updateUser } = useAuth();
  const { showToast } = useToast();
  const [profile, setProfile] = useState({ name: '', address: '', location: '', phone: '' });
  const [saving, setSaving] = useState(false);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        try {
          const db = await getDatabase();
          const existing = await getCompanyProfile(db, quarryId || 1);
          if (existing) {
            setProfile({
              name: existing.name || existing.company_name || '',
              address: existing.address || '',
              location: existing.location || '',
              phone: existing.phone || '',
            });
          }
        } catch (error) {
          console.error('Error loading profile:', error);
        }
      })();
    }, [quarryId])
  );

  const handleSave = async () => {
    if (!profile.name.trim()) {
      showToast('Company name is required.', 'error', 'Missing Information');
      return;
    }
    setSaving(true);
    try {
      const db = await getDatabase();
      const targetQid = quarryId || 1;
      const savedData = await saveCompanyProfile(db, { ...profile, id: targetQid });
      
      updateUser({
        company_name: profile.name,
        name: profile.name,
        phone: profile.phone,
        location: profile.location,
        address: profile.address,
      });

      showToast('Company profile saved successfully & synced to server! ✨', 'success', 'Saved Successfully');
    } catch (error) {
      console.error('Save Profile Error:', error);
      showToast('Failed to save profile. Please check connection and try again.', 'error', 'Save Failed');
    } finally {
      setSaving(false);
    }
  };

  const updateField = (key, value) => setProfile(prev => ({ ...prev, [key]: value }));

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Company Profile</Text>
          <Text style={styles.headerSub}>Business details for bills</Text>
        </View>
        <View style={styles.headerIconBox}>
          <Ionicons name="business" size={22} color={Colors.primary} />
        </View>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Info notice */}
          <View style={styles.infoCard}>
            <Ionicons name="information-circle" size={18} color={Colors.info} />
            <Text style={styles.infoText}>
              This information is automatically used in bill headers when you create new bills.
            </Text>
          </View>

          {/* Form card */}
          <Card style={styles.formCard}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionIconBox}>
                <Ionicons name="briefcase-outline" size={18} color={Colors.primary} />
              </View>
              <Text style={styles.sectionTitle}>Business Information</Text>
            </View>

            <Input
              label="Company Name"
              value={profile.name}
              onChangeText={(v) => updateField('name', v)}
              placeholder="Enter company name"
              icon="business-outline"
              required
            />
            <Input
              label="Phone Number"
              value={profile.phone}
              onChangeText={(v) => updateField('phone', v)}
              placeholder="Enter contact number"
              icon="call-outline"
              keyboardType="phone-pad"
            />
          </Card>

          <Card style={styles.formCard}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionIconBox}>
                <Ionicons name="location-outline" size={18} color={Colors.primary} />
              </View>
              <Text style={styles.sectionTitle}>Location</Text>
            </View>

            <Input
              label="Address"
              value={profile.address}
              onChangeText={(v) => updateField('address', v)}
              placeholder="Enter full address"
              icon="home-outline"
              multiline
              numberOfLines={3}
            />
            <Input
              label="City / Location"
              value={profile.location}
              onChangeText={(v) => updateField('location', v)}
              placeholder="e.g. Uthukuli, Tirupur - 638751"
              icon="pin-outline"
            />
          </Card>

          <Button
            title="Save Profile"
            onPress={handleSave}
            loading={saving}
            fullWidth
            size="lg"
            icon="checkmark-circle-outline"
            style={styles.saveBtn}
          />
          <View style={{ height: Spacing.xxxl }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.md,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  headerTitle: {
    ...Typography.h2,
    color: Colors.text,
  },
  headerSub: {
    ...Typography.caption,
    color: Colors.textTertiary,
    marginTop: 2,
  },
  headerIconBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primarySurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: { flex: 1 },
  scrollContent: {
    padding: Spacing.lg,
  },
  infoCard: {
    flexDirection: 'row',
    backgroundColor: Colors.infoLight,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
    alignItems: 'flex-start',
    borderWidth: 1,
    borderColor: 'rgba(28, 95, 171, 0.18)',
  },
  infoText: {
    ...Typography.caption,
    color: Colors.info,
    flex: 1,
    lineHeight: 20,
  },
  formCard: {
    marginBottom: Spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  sectionIconBox: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.primarySurface,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  sectionTitle: {
    ...Typography.h3,
    color: Colors.text,
  },
  saveBtn: {
    marginTop: Spacing.sm,
    marginBottom: Spacing.sm,
  },
});
