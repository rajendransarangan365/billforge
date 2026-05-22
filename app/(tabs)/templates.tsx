// @ts-nocheck
import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  SafeAreaView, Alert, ActivityIndicator, Platform,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { Colors, Typography, Spacing, BorderRadius } from '../../src/theme';
import { Card, Button, FAB, EmptyState } from '../../src/components';
import { getDatabase, getTemplates, saveTemplate, deleteTemplate } from '../../src/database/db';
import { parseTemplate } from '../../src/services/templateParser';

export default function TemplatesScreen() {
  const router = useRouter();
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  const loadTemplates = useCallback(async () => {
    try {
      const db = await getDatabase();
      const list = await getTemplates(db);
      setTemplates(list);
    } catch (error) {
      console.error('Error loading templates:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadTemplates();
    }, [loadTemplates])
  );

  const handleUploadTemplate = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/msword',
        ],
        copyToCacheDirectory: true,
      });

      if (result.canceled) return;

      setUploading(true);
      const file = result.assets[0];
      
      let base64Content = '';
      
      if (Platform.OS === 'web') {
        // Web: Read file using fetch and FileReader
        const response = await fetch(file.uri);
        const blob = await response.blob();
        base64Content = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            const base64String = (reader.result as string).split(',')[1];
            resolve(base64String);
          };
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
      } else {
        // Mobile: Use expo-file-system
        base64Content = await FileSystem.readAsStringAsync(file.uri, {
          encoding: FileSystem.EncodingType.Base64,
        });
      }

      // Parse template to extract fields
      const parsed = parseTemplate(base64Content);
      
      if (!parsed.success) {
        Alert.alert('Parsing Error', parsed.error || 'Could not parse the template. Please ensure it contains <FieldName> placeholders.');
        setUploading(false);
        return;
      }

      if (parsed.allFields.length === 0) {
        Alert.alert(
          'No Fields Found',
          'No <FieldName> placeholders were found in this document. Please add placeholders using angle bracket notation like <CustomerName>, <Date>, etc.',
        );
        setUploading(false);
        return;
      }

      // Save template name (remove extension)
      const templateName = file.name.replace(/\.(docx|doc)$/i, '');
      
      const db = await getDatabase();
      await saveTemplate(db, {
        name: templateName,
        file_uri: file.uri,
        file_base64: base64Content,
        headerFields: parsed.headerFields,
        tableFields: parsed.tableFields,
        allFields: parsed.allFields,
      });

      Alert.alert(
        'Template Uploaded',
        `"${templateName}" uploaded successfully.\n\nDetected ${parsed.headerFields.length} header field(s) and ${parsed.tableFields.length} table field(s).`,
      );

      await loadTemplates();
    } catch (error) {
      console.error('Upload error:', error);
      Alert.alert('Upload Error', 'Failed to upload template. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteTemplate = (template) => {
    const performDelete = async () => {
      try {
        const db = await getDatabase();
        await deleteTemplate(db, template.id);
        await loadTemplates();
      } catch (error) {
        console.error('Delete error:', error);
        Alert.alert('Error', 'Failed to delete template. It might have associated bills.');
      }
    };

    if (Platform.OS === 'web') {
      const confirmed = window.confirm(`Are you sure you want to delete "${template.name}"? This cannot be undone.`);
      if (confirmed) {
        performDelete();
      }
    } else {
      Alert.alert(
        'Delete Template',
        `Are you sure you want to delete "${template.name}"? This cannot be undone.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Delete', style: 'destructive', onPress: performDelete },
        ],
      );
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Templates</Text>
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
        <Text style={styles.headerTitle}>Templates</Text>
        <Text style={styles.headerCount}>{templates.length} template(s)</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {uploading && (
          <Card style={styles.uploadingCard}>
            <ActivityIndicator color={Colors.primary} />
            <Text style={styles.uploadingText}>Parsing template...</Text>
          </Card>
        )}

        {templates.length === 0 && !uploading ? (
          <EmptyState
            icon="document-attach-outline"
            title="No Templates Yet"
            message="Upload a Word document (.docx) with <FieldName> placeholders to create your first billing template."
          >
            <Button
              title="Upload Template"
              onPress={handleUploadTemplate}
              icon="cloud-upload-outline"
              size="lg"
            />
          </EmptyState>
        ) : (
          templates.map((template) => {
            const headerFields = JSON.parse(template.header_fields_json || '[]');
            const tableFields = JSON.parse(template.table_fields_json || '[]');
            const allFields = JSON.parse(template.all_fields_json || '[]');

            return (
              <Card key={template.id} style={styles.templateCard}>
                <View style={styles.templateCardRow}>
                  {/* Info Area (Touchable for details) */}
                  <TouchableOpacity 
                    style={styles.templateMainArea}
                    onPress={() => router.push(`/template-detail/${template.id}`)}
                    activeOpacity={0.6}
                  >
                    <View style={styles.templateIcon}>
                      <Ionicons name="document-text" size={22} color={Colors.primary} />
                    </View>
                    <View style={styles.templateInfo}>
                      <Text style={styles.templateName} numberOfLines={1}>{template.name}</Text>
                      <Text style={styles.templateMeta}>
                        {allFields.length} field(s) -- {headerFields.length} header, {tableFields.length} table
                      </Text>
                      <Text style={styles.templateDate}>
                        Added {new Date(template.created_at).toLocaleDateString('en-IN')}
                      </Text>
                    </View>
                  </TouchableOpacity>

                  {/* Actions Area */}
                  <View style={styles.templateActions}>
                    <TouchableOpacity
                      style={[styles.actionBtn, { backgroundColor: '#E8F5E9' }]}
                      onPress={() => router.push(`/bill-form/${template.id}`)}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <Ionicons name="add-circle" size={24} color={Colors.success} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.actionBtn, { backgroundColor: '#FFEBEE' }]}
                      onPress={() => handleDeleteTemplate(template)}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <Ionicons name="trash" size={20} color={Colors.danger} />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Field Tags */}
                <TouchableOpacity 
                  onPress={() => router.push(`/template-detail/${template.id}`)}
                  activeOpacity={0.8}
                >
                  <View style={styles.fieldTags}>
                    {allFields.slice(0, 6).map((field, idx) => (
                      <View key={idx} style={[
                        styles.tag,
                        tableFields.some(tf => tf.name === field.name) && styles.tagTable,
                      ]}>
                        <Text style={[
                          styles.tagText,
                          tableFields.some(tf => tf.name === field.name) && styles.tagTextTable,
                        ]}>
                          {field.label}
                        </Text>
                      </View>
                    ))}
                    {allFields.length > 6 && (
                      <View style={styles.tagMore}>
                        <Text style={styles.tagMoreText}>+{allFields.length - 6}</Text>
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              </Card>
            );
          })
        )}

        <View style={{ height: 80 }} />
      </ScrollView>

      <FAB icon="add" onPress={handleUploadTemplate} />
    </SafeAreaView>
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
    alignItems: 'baseline',
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
  headerCount: {
    ...Typography.caption,
    color: Colors.textTertiary,
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
  uploadingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.lg,
    backgroundColor: Colors.infoLight,
    borderWidth: 0,
  },
  uploadingText: {
    ...Typography.bodyMedium,
    color: Colors.info,
    marginLeft: Spacing.md,
  },
  templateCard: {
    marginBottom: Spacing.md,
  },
  templateCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  templateIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#EBF5FB',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  templateMainArea: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  templateInfo: {
    flex: 1,
  },
  templateName: {
    ...Typography.bodySemibold,
    color: Colors.text,
  },
  templateMeta: {
    ...Typography.caption,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  templateDate: {
    ...Typography.small,
    color: Colors.textTertiary,
    marginTop: 2,
  },
  templateActions: {
    flexDirection: 'row',
    gap: Spacing.md,
    alignItems: 'center',
  },
  actionBtn: {
    padding: 4,
  },
  fieldTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs + 2,
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
  },
  tag: {
    backgroundColor: Colors.background,
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
  },
  tagTable: {
    backgroundColor: '#FFF3CD',
  },
  tagText: {
    ...Typography.small,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  tagTextTable: {
    color: Colors.warning,
  },
  tagMore: {
    backgroundColor: Colors.divider,
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
  },
  tagMoreText: {
    ...Typography.small,
    color: Colors.textTertiary,
    fontWeight: '600',
  },
});
