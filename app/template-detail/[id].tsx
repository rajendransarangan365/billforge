// @ts-nocheck
import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, Alert, Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius } from '../../src/theme';
import { Card, Button } from '../../src/components';
import { getDatabase, getTemplateById, deleteTemplate } from '../../src/database/db';

export default function TemplateDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams();
  const [template, setTemplate] = useState(null);
  const [headerFields, setHeaderFields] = useState([]);
  const [tableFields, setTableFields] = useState([]);

  useEffect(() => {
    loadTemplate();
  }, [id]);

  const loadTemplate = async () => {
    try {
      const db = await getDatabase();
      const t = await getTemplateById(db, parseInt(id));
      if (t) {
        setTemplate(t);
        setHeaderFields(JSON.parse(t.header_fields_json || '[]'));
        setTableFields(JSON.parse(t.table_fields_json || '[]'));
      }
    } catch (error) {
      console.error('Error loading template:', error);
    }
  };

  const handleDelete = () => {
    const performDelete = async () => {
      try {
        const db = await getDatabase();
        await deleteTemplate(db, parseInt(id));
        router.back();
      } catch (error) {
        console.error('Delete template error:', error);
        Alert.alert('Error', 'Failed to delete template. It might have associated bills.');
      }
    };

    if (Platform.OS === 'web') {
      const confirmed = window.confirm(`Are you sure you want to delete "${template?.name}"? This cannot be undone.`);
      if (confirmed) {
        performDelete();
      }
    } else {
      Alert.alert(
        'Delete Template',
        `Delete "${template?.name}"? This cannot be undone.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: performDelete,
          },
        ],
      );
    }
  };

  const getFieldIcon = (type) => {
    switch (type) {
      case 'date': return 'calendar-outline';
      case 'time': return 'time-outline';
      case 'phone': return 'call-outline';
      case 'numeric':
      case 'number': return 'calculator-outline';
      case 'email': return 'mail-outline';
      default: return 'text-outline';
    }
  };

  if (!template) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.centered}>
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.text} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle} numberOfLines={1}>{template.name}</Text>
          <Text style={styles.headerSub}>Template Details</Text>
        </View>
        <TouchableOpacity onPress={handleDelete} style={styles.deleteBtn}>
          <Ionicons name="trash-outline" size={20} color={Colors.danger} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Summary Card */}
        <Card style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>{headerFields.length + tableFields.length}</Text>
              <Text style={styles.summaryLabel}>Total Fields</Text>
            </View>
            <View style={[styles.summaryItem, styles.summaryDivider]}>
              <Text style={styles.summaryValue}>{headerFields.length}</Text>
              <Text style={styles.summaryLabel}>Header</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>{tableFields.length}</Text>
              <Text style={styles.summaryLabel}>Table</Text>
            </View>
          </View>
        </Card>

        {/* Header Fields */}
        {headerFields.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Header Fields</Text>
            <Text style={styles.sectionSub}>These fields appear once in the bill header</Text>
            <Card style={styles.fieldListCard}>
              {headerFields.map((field, idx) => (
                <View key={idx} style={[styles.fieldItem, idx > 0 && styles.fieldItemBorder]}>
                  <View style={[styles.fieldIconCircle, { backgroundColor: Colors.primarySurface }]}>
                    <Ionicons name={getFieldIcon(field.type)} size={16} color={Colors.primary} />
                  </View>
                  <View style={styles.fieldInfo}>
                    <Text style={styles.fieldLabel}>{field.label}</Text>
                    <Text style={styles.fieldCode}>&lt;{field.name}&gt;</Text>
                  </View>
                  <View style={styles.typeBadge}>
                    <Text style={styles.typeBadgeText}>{field.type}</Text>
                  </View>
                </View>
              ))}
            </Card>
          </>
        )}

        {/* Table Fields */}
        {tableFields.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Table / Row Fields</Text>
            <Text style={styles.sectionSub}>These fields repeat for each line item row</Text>
            <Card style={styles.fieldListCard}>
              {tableFields.map((field, idx) => (
                <View key={idx} style={[styles.fieldItem, idx > 0 && styles.fieldItemBorder]}>
                  <View style={[styles.fieldIconCircle, { backgroundColor: Colors.amberSurface }]}>
                    <Ionicons name={getFieldIcon(field.type)} size={16} color={Colors.warning} />
                  </View>
                  <View style={styles.fieldInfo}>
                    <Text style={styles.fieldLabel}>{field.label}</Text>
                    <Text style={styles.fieldCode}>&lt;{field.name}&gt;</Text>
                  </View>
                  <View style={[styles.typeBadge, { backgroundColor: Colors.amberSurface }]}>
                    <Text style={[styles.typeBadgeText, { color: Colors.warning }]}>{field.type}</Text>
                  </View>
                </View>
              ))}
            </Card>
          </>
        )}

        <View style={{ height: 20 }} />

        <Button
          title="Create Bill with This Template"
          onPress={() => router.push(`/bill-form/${template.id}`)}
          fullWidth
          size="lg"
          icon="add-circle-outline"
          style={styles.createBtn}
        />

        <View style={{ height: 30 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    ...Typography.body,
    color: Colors.textTertiary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.md,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    flex: 1,
    marginHorizontal: Spacing.md,
  },
  headerTitle: {
    ...Typography.h3,
    color: Colors.text,
  },
  headerSub: {
    ...Typography.small,
    color: Colors.textTertiary,
  },
  deleteBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFF5F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.lg,
  },
  summaryCard: {
    marginBottom: Spacing.xxl,
  },
  summaryRow: {
    flexDirection: 'row',
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryDivider: {
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: Colors.divider,
  },
  summaryValue: {
    ...Typography.h1,
    color: Colors.primary,
  },
  summaryLabel: {
    ...Typography.caption,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  sectionTitle: {
    ...Typography.h3,
    color: Colors.text,
    marginBottom: 2,
  },
  sectionSub: {
    ...Typography.caption,
    color: Colors.textTertiary,
    marginBottom: Spacing.md,
  },
  fieldListCard: {
    marginBottom: Spacing.xxl,
    paddingVertical: Spacing.xs,
  },
  fieldItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
  },
  fieldItemBorder: {
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
  },
  fieldIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  fieldInfo: {
    flex: 1,
  },
  fieldLabel: {
    ...Typography.bodyMedium,
    color: Colors.text,
  },
  fieldCode: {
    ...Typography.small,
    color: Colors.textTertiary,
    marginTop: 1,
    fontFamily: 'monospace',
  },
  typeBadge: {
    backgroundColor: Colors.background,
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
  },
  typeBadgeText: {
    ...Typography.small,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  createBtn: {
    backgroundColor: Colors.primary,
  },
});
