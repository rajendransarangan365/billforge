// @ts-nocheck
import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, ActivityIndicator, Platform,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { Colors, Typography, Spacing, BorderRadius } from '../../src/theme';
import { Card, FAB, EmptyState } from '../../src/components';
import { getDatabase, getTemplates, saveTemplate, deleteTemplate } from '../../src/database/db';
import { parseTemplate } from '../../src/services/templateParser';

export default function TemplatesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
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

  useFocusEffect(useCallback(() => { loadTemplates(); }, [loadTemplates]));

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
        const response = await fetch(file.uri);
        const blob = await response.blob();
        base64Content = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
      } else {
        try {
          base64Content = await FileSystem.readAsStringAsync(file.uri, { encoding: FileSystem.EncodingType.Base64 });
        } catch (firstErr) {
          try {
            const decodedUri = decodeURIComponent(file.uri);
            base64Content = await FileSystem.readAsStringAsync(decodedUri, { encoding: FileSystem.EncodingType.Base64 });
          } catch (secondErr) {
            const safeName = file.name ? file.name.replace(/[^A-Za-z0-9.]/g, '_') : 'temp_template.docx';
            const tempUri = `${FileSystem.cacheDirectory}${Date.now()}_${safeName}`;
            try {
              await FileSystem.copyAsync({ from: file.uri, to: tempUri });
              base64Content = await FileSystem.readAsStringAsync(tempUri, { encoding: FileSystem.EncodingType.Base64 });
              try { await FileSystem.deleteAsync(tempUri, { idempotent: true }); } catch (e) {}
            } catch (copyErr) {
              throw new Error(`Could not read file: ${copyErr instanceof Error ? copyErr.message : String(copyErr)}`);
            }
          }
        }
      }
      const parsed = parseTemplate(base64Content);
      if (!parsed.success) {
        Alert.alert('Parsing Error', parsed.error || 'Could not parse template. Ensure it has <FieldName> placeholders.');
        setUploading(false); return;
      }
      if (parsed.allFields.length === 0) {
        Alert.alert('No Fields Found', 'No <FieldName> placeholders found. Add placeholders like <CustomerName>, <Date>.');
        setUploading(false); return;
      }
      const templateName = file.name.replace(/\.(docx|doc)$/i, '');
      const db = await getDatabase();
      await saveTemplate(db, { name: templateName, file_uri: file.uri, file_base64: base64Content, headerFields: parsed.headerFields, tableFields: parsed.tableFields, allFields: parsed.allFields });
      Alert.alert('Uploaded', `"${templateName}" uploaded.\n${parsed.headerFields.length} header, ${parsed.tableFields.length} table field(s).`);
      await loadTemplates();
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      Alert.alert('Upload Error', `Failed to upload template.\n\n${msg}`);
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
        Alert.alert('Error', 'Failed to delete template. It may have associated bills.');
      }
    };
    if (Platform.OS === 'web') {
      if (window.confirm(`Delete "${template.name}"?`)) performDelete();
    } else {
      Alert.alert('Delete Template', `Delete "${template.name}"? This cannot be undone.`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: performDelete },
      ]);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Templates</Text>
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
          <Text style={styles.headerTitle}>Templates</Text>
          <Text style={styles.headerCount}>{templates.length} template{templates.length !== 1 ? 's' : ''}</Text>
        </View>
        <TouchableOpacity style={styles.uploadBtn} onPress={handleUploadTemplate} activeOpacity={0.8}>
          <Ionicons name="cloud-upload-outline" size={20} color={Colors.textOnPrimary} />
          <Text style={styles.uploadBtnText}>Upload</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {uploading && (
          <View style={styles.uploadingBanner}>
            <ActivityIndicator color={Colors.accent} size="small" />
            <Text style={styles.uploadingText}>Parsing template…</Text>
          </View>
        )}

        {templates.length === 0 && !uploading ? (
          <EmptyState
            icon="document-attach-outline"
            title="No Templates Yet"
            message={"Upload a Word document (.docx) with <FieldName> placeholders to create your first billing template."}
          >
            <TouchableOpacity style={styles.emptyUploadBtn} onPress={handleUploadTemplate} activeOpacity={0.8}>
              <Ionicons name="cloud-upload-outline" size={20} color={Colors.textOnPrimary} style={{ marginRight: 8 }} />
              <Text style={styles.emptyUploadText}>Upload Template</Text>
            </TouchableOpacity>
          </EmptyState>
        ) : (
          templates.map((template) => {
            const headerFields = JSON.parse(template.header_fields_json || '[]');
            const tableFields = JSON.parse(template.table_fields_json || '[]');
            const allFields = JSON.parse(template.all_fields_json || '[]');
            return (
              <Card key={template.id} style={styles.templateCard}>
                {/* Top row */}
                <TouchableOpacity
                  style={styles.templateMain}
                  onPress={() => router.push(`/template-detail/${template.id}`)}
                  activeOpacity={0.7}
                >
                  <View style={styles.templateIconBox}>
                    <Ionicons name="document-text" size={22} color={Colors.accent} />
                  </View>
                  <View style={styles.templateInfo}>
                    <Text style={styles.templateName} numberOfLines={1}>{template.name}</Text>
                    <Text style={styles.templateMeta}>
                      {allFields.length} field(s) — {headerFields.length} header, {tableFields.length} table
                    </Text>
                    <Text style={styles.templateDate}>
                      Added {new Date(template.created_at).toLocaleDateString('en-IN')}
                    </Text>
                  </View>
                  <View style={styles.templateActions}>
                    <TouchableOpacity
                      style={[styles.iconBtn, { backgroundColor: Colors.successLight }]}
                      onPress={() => router.push(`/bill-form/${template.id}`)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Ionicons name="add-circle" size={20} color={Colors.success} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.iconBtn, { backgroundColor: Colors.dangerLight }]}
                      onPress={() => handleDeleteTemplate(template)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Ionicons name="trash-outline" size={18} color={Colors.danger} />
                    </TouchableOpacity>
                  </View>
                </TouchableOpacity>

                {/* Field tags */}
                {allFields.length > 0 && (
                  <View style={styles.tagRow}>
                    {allFields.slice(0, 7).map((field, idx) => {
                      const isTable = tableFields.some(tf => tf.name === field.name);
                      return (
                        <View key={idx} style={[styles.tag, isTable && styles.tagTable]}>
                          <Text style={[styles.tagText, isTable && styles.tagTextTable]}>{field.label}</Text>
                        </View>
                      );
                    })}
                    {allFields.length > 7 && (
                      <View style={styles.tagMore}>
                        <Text style={styles.tagMoreText}>+{allFields.length - 7}</Text>
                      </View>
                    )}
                  </View>
                )}
              </Card>
            );
          })
        )}
        <View style={{ height: 100 }} />
      </ScrollView>

      <FAB icon="add" onPress={handleUploadTemplate} bgColor={Colors.accent} />
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
  headerCount: {
    ...Typography.caption,
    color: Colors.textTertiary,
    marginTop: 2,
  },
  uploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    gap: Spacing.xs,
  },
  uploadBtnText: {
    ...Typography.captionSemibold,
    color: Colors.textOnPrimary,
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
  uploadingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.accentSurface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
    gap: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.accentLight,
  },
  uploadingText: {
    ...Typography.bodyMedium,
    color: Colors.accent,
  },
  emptyUploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.accent,
    paddingHorizontal: Spacing.xxl,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
  },
  emptyUploadText: {
    ...Typography.button,
    color: Colors.textOnPrimary,
  },
  templateCard: {
    marginBottom: Spacing.md,
    padding: Spacing.md,
  },
  templateMain: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  templateIconBox: {
    width: 46,
    height: 46,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.accentSurface,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
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
    gap: Spacing.sm,
    alignItems: 'center',
    marginLeft: Spacing.sm,
  },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: BorderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tagRow: {
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
    borderRadius: BorderRadius.xs,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  tagTable: {
    backgroundColor: Colors.amberSurface,
    borderColor: Colors.amberLight,
  },
  tagText: {
    ...Typography.small,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  tagTextTable: {
    color: Colors.warning,
    fontWeight: '600',
  },
  tagMore: {
    backgroundColor: Colors.divider,
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.xs,
  },
  tagMoreText: {
    ...Typography.small,
    color: Colors.textTertiary,
    fontWeight: '700',
  },
});
