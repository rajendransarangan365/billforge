// @ts-nocheck
import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, SafeAreaView,
  Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing } from '../../src/theme';
import { Card, Button, Input } from '../../src/components';
import { getDatabase, getCompanyProfile, saveCompanyProfile } from '../../src/database/db';

export default function ProfileScreen() {
  const [profile, setProfile] = useState({
    name: '',
    address: '',
    location: '',
    phone: '',
  });
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        try {
          const db = await getDatabase();
          const existing = await getCompanyProfile(db);
          if (existing) {
            setProfile({
              name: existing.name || '',
              address: existing.address || '',
              location: existing.location || '',
              phone: existing.phone || '',
            });
          }
        } catch (error) {
          console.error('Error loading profile:', error);
        } finally {
          setLoaded(true);
        }
      })();
    }, [])
  );

  const handleSave = async () => {
    if (!profile.name.trim()) {
      Alert.alert('Required', 'Company name is required.');
      return;
    }

    setSaving(true);
    try {
      const db = await getDatabase();
      await saveCompanyProfile(db, profile);
      Alert.alert('Saved', 'Company profile updated successfully.');
    } catch (error) {
      console.error('Save error:', error);
      Alert.alert('Error', 'Failed to save profile.');
    } finally {
      setSaving(false);
    }
  };

  const updateField = (key, value) => {
    setProfile(prev => ({ ...prev, [key]: value }));
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Company Profile</Text>
        <Text style={styles.headerSub}>Your business details for bills</Text>
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
          <Card style={styles.formCard}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionIconCircle}>
                <Ionicons name="business" size={20} color={Colors.primary} />
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
              label="Address"
              value={profile.address}
              onChangeText={(v) => updateField('address', v)}
              placeholder="Enter full address"
              icon="location-outline"
              multiline
              numberOfLines={3}
            />

            <Input
              label="Location / City"
              value={profile.location}
              onChangeText={(v) => updateField('location', v)}
              placeholder="e.g. Uthukuli, Tirupur - 638751"
              icon="pin-outline"
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

          <View style={styles.infoCard}>
            <Ionicons name="information-circle-outline" size={18} color={Colors.info} />
            <Text style={styles.infoText}>
              This information will be automatically filled in the bill header when you create new bills.
            </Text>
          </View>

          <Button
            title="Save Profile"
            onPress={handleSave}
            loading={saving}
            fullWidth
            size="lg"
            icon="checkmark-circle-outline"
            style={styles.saveBtn}
          />

          <View style={{ height: 30 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  headerTitle: {
    ...Typography.h1,
    color: Colors.text,
  },
  headerSub: {
    ...Typography.caption,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.lg,
  },
  formCard: {
    marginBottom: Spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  sectionIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#EBF5FB',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  sectionTitle: {
    ...Typography.h3,
    color: Colors.text,
  },
  infoCard: {
    flexDirection: 'row',
    backgroundColor: Colors.infoLight,
    padding: Spacing.md,
    borderRadius: 10,
    gap: Spacing.sm,
    marginBottom: Spacing.xl,
    alignItems: 'flex-start',
  },
  infoText: {
    ...Typography.caption,
    color: Colors.info,
    flex: 1,
    lineHeight: 20,
  },
  saveBtn: {
    marginTop: Spacing.sm,
  },
});
