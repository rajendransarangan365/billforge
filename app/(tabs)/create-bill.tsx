// @ts-nocheck
import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  SafeAreaView, ActivityIndicator,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius } from '../../src/theme';
import { Card, EmptyState } from '../../src/components';
import { getDatabase, getTemplates } from '../../src/database/db';

export default function CreateBillScreen() {
  const router = useRouter();
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
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Create New Bill</Text>
        </View>
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Create New Bill</Text>
        <Text style={styles.headerSub}>Select a template to begin</Text>
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
            message="Upload a Word document template first to create bills. Go to the Templates tab to upload one."
          />
        ) : (
          templates.map((template) => {
            const headerFields = JSON.parse(template.header_fields_json || '[]');
            const tableFields = JSON.parse(template.table_fields_json || '[]');
            const allFields = JSON.parse(template.all_fields_json || '[]');

            return (
              <TouchableOpacity
                key={template.id}
                activeOpacity={0.7}
                onPress={() => router.push(`/bill-form/${template.id}`)}
              >
                <Card style={styles.templateCard}>
                  <View style={styles.templateRow}>
                    <View style={styles.templateIcon}>
                      <Ionicons name="document-text" size={24} color={Colors.primary} />
                    </View>
                    <View style={styles.templateInfo}>
                      <Text style={styles.templateName}>{template.name}</Text>
                      <Text style={styles.templateMeta}>
                        {allFields.length} fields -- {headerFields.length} header, {tableFields.length} table
                      </Text>
                    </View>
                    <View style={styles.arrowCircle}>
                      <Ionicons name="arrow-forward" size={18} color={Colors.primary} />
                    </View>
                  </View>

                  <View style={styles.fieldList}>
                    {headerFields.slice(0, 4).map((field, idx) => (
                      <View key={idx} style={styles.fieldRow}>
                        <Ionicons
                          name={getFieldIcon(field.type)}
                          size={14}
                          color={Colors.textTertiary}
                        />
                        <Text style={styles.fieldName}>{field.label}</Text>
                        <Text style={styles.fieldType}>{field.type}</Text>
                      </View>
                    ))}
                    {tableFields.length > 0 && (
                      <View style={styles.fieldRow}>
                        <Ionicons name="grid-outline" size={14} color={Colors.accent} />
                        <Text style={styles.fieldName}>
                          Table: {tableFields.map(f => f.label).join(', ')}
                        </Text>
                      </View>
                    )}
                  </View>
                </Card>
              </TouchableOpacity>
            );
          })
        )}
        <View style={{ height: 30 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

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
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.lg,
  },
  templateCard: {
    marginBottom: Spacing.md,
  },
  templateRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  templateIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#EBF5FB',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  templateInfo: {
    flex: 1,
  },
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
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fieldList: {
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    gap: Spacing.sm,
  },
  fieldName: {
    ...Typography.caption,
    color: Colors.textSecondary,
    flex: 1,
  },
  fieldType: {
    ...Typography.small,
    color: Colors.textTertiary,
    backgroundColor: Colors.background,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: 'hidden',
  },
});
