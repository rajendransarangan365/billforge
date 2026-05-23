// @ts-nocheck
import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius } from '../../src/theme';
import { Card, EmptyState } from '../../src/components';
import { getDatabase, getTemplates } from '../../src/database/db';

function getFieldIcon(type) {
  switch (type) {
    case 'date': return 'calendar-outline';
    case 'time': return 'time-outline';
    case 'phone': return 'call-outline';
    case 'numeric':
    case 'number': return 'calculator-outline';
    case 'email': return 'mail-outline';
    default: return 'text-outline';
  }
}

export default function CreateBillScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        try {
          const db = await getDatabase();
          const list = await getTemplates(db);
          setTemplates(list);
        } catch (error) {
          console.error('Error loading templates:', error);
        } finally {
          setLoading(false);
        }
      })();
    }, [])
  );

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>New Bill</Text>
        </View>
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={Colors.accent} />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>New Bill</Text>
          <Text style={styles.headerSub}>Select a template to begin</Text>
        </View>
        <View style={styles.headerIconBox}>
          <Ionicons name="add-circle-outline" size={22} color={Colors.accent} />
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {templates.length === 0 ? (
          <EmptyState
            icon="layers-outline"
            title="No Templates Available"
            message={"Upload a Word document template first to create bills. Go to the Templates tab to upload one."}
          >
            <TouchableOpacity
              style={styles.goToTemplates}
              onPress={() => router.push('/(tabs)/templates')}
              activeOpacity={0.8}
            >
              <Ionicons name="cloud-upload-outline" size={18} color={Colors.textOnPrimary} style={{ marginRight: 8 }} />
              <Text style={styles.goToTemplatesText}>Upload Template</Text>
            </TouchableOpacity>
          </EmptyState>
        ) : (
          templates.map((template) => {
            const headerFields = JSON.parse(template.header_fields_json || '[]');
            const tableFields = JSON.parse(template.table_fields_json || '[]');
            const allFields = JSON.parse(template.all_fields_json || '[]');
            return (
              <TouchableOpacity
                key={template.id}
                activeOpacity={0.8}
                onPress={() => router.push(`/bill-form/${template.id}`)}
              >
                <Card style={styles.templateCard} variant="elevated">
                  <View style={styles.templateRow}>
                    <View style={styles.templateIconBox}>
                      <Ionicons name="document-text" size={24} color={Colors.accent} />
                    </View>
                    <View style={styles.templateInfo}>
                      <Text style={styles.templateName}>{template.name}</Text>
                      <Text style={styles.templateMeta}>
                        {allFields.length} fields · {headerFields.length} header, {tableFields.length} table
                      </Text>
                    </View>
                    <View style={styles.arrowCircle}>
                      <Ionicons name="arrow-forward" size={16} color={Colors.accent} />
                    </View>
                  </View>

                  {/* Field Preview */}
                  {headerFields.length > 0 && (
                    <View style={styles.fieldPreview}>
                      {headerFields.slice(0, 4).map((field, idx) => (
                        <View key={idx} style={styles.fieldChip}>
                          <Ionicons name={getFieldIcon(field.type)} size={12} color={Colors.primary} />
                          <Text style={styles.fieldChipText}>{field.label}</Text>
                        </View>
                      ))}
                      {tableFields.length > 0 && (
                        <View style={[styles.fieldChip, styles.fieldChipTable]}>
                          <Ionicons name="grid-outline" size={12} color={Colors.warning} />
                          <Text style={[styles.fieldChipText, { color: Colors.warning }]}>
                            {tableFields.length} table col{tableFields.length > 1 ? 's' : ''}
                          </Text>
                        </View>
                      )}
                    </View>
                  )}
                </Card>
              </TouchableOpacity>
            );
          })
        )}
        <View style={{ height: 24 }} />
      </ScrollView>
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
    backgroundColor: Colors.accentSurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scroll: { flex: 1 },
  scrollContent: {
    padding: Spacing.lg,
  },
  goToTemplates: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.accent,
    paddingHorizontal: Spacing.xxl,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
  },
  goToTemplatesText: {
    ...Typography.button,
    color: Colors.textOnPrimary,
  },
  templateCard: {
    marginBottom: Spacing.md,
  },
  templateRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  templateIconBox: {
    width: 50,
    height: 50,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.accentSurface,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  templateInfo: { flex: 1 },
  templateName: {
    ...Typography.h3,
    color: Colors.text,
  },
  templateMeta: {
    ...Typography.caption,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  arrowCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.accentSurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fieldPreview: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs + 2,
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
  },
  fieldChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primarySurface,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.xs,
    gap: Spacing.xs,
  },
  fieldChipTable: {
    backgroundColor: Colors.amberSurface,
  },
  fieldChipText: {
    ...Typography.small,
    color: Colors.primary,
    fontWeight: '500',
  },
});
