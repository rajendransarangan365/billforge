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
import { cacheDirectory, EncodingType } from 'expo-file-system';
import { shareAsync } from 'expo-sharing';
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
  const [showGuide, setShowGuide] = useState(false);

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
          base64Content = await FileSystem.readAsStringAsync(file.uri, { encoding: EncodingType.Base64 });
        } catch (firstErr) {
          try {
            const decodedUri = decodeURIComponent(file.uri);
            base64Content = await FileSystem.readAsStringAsync(decodedUri, { encoding: EncodingType.Base64 });
          } catch (secondErr) {
            const safeName = file.name ? file.name.replace(/[^A-Za-z0-9.]/g, '_') : 'temp_template.docx';
            const tempUri = `${cacheDirectory}${Date.now()}_${safeName}`;
            try {
              await FileSystem.copyAsync({ from: file.uri, to: tempUri });
              base64Content = await FileSystem.readAsStringAsync(tempUri, { encoding: EncodingType.Base64 });
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

  const handleExportTemplate = async (template) => {
    if (!template.file_base64) {
      Alert.alert('Error', 'This template does not have a Word document file associated with it.');
      return;
    }
    
    try {
      const fileName = `${template.name.replace(/[^A-Za-z0-9]/g, '_')}.docx`;
      
      if (Platform.OS === 'web') {
        const byteCharacters = atob(template.file_base64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
        
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } else {
        const fileUri = `${cacheDirectory}${fileName}`;
        await FileSystem.writeAsStringAsync(fileUri, template.file_base64, {
          encoding: EncodingType.Base64,
        });
        
        await shareAsync(fileUri, {
          mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          dialogTitle: `Export ${template.name}`,
          UTI: 'org.openxmlformats.wordprocessingml.document',
        });
      }
    } catch (error) {
      console.error('Error exporting template:', error);
      Alert.alert('Export Error', 'Failed to export/share the template file.');
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

        {/* Collapsible Template Creation Guide Card */}
        <Card style={styles.guideCard}>
          <TouchableOpacity
            style={styles.guideHeader}
            onPress={() => setShowGuide(prev => !prev)}
            activeOpacity={0.7}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
              <View style={[styles.guideIconCircle, { backgroundColor: '#EBF5FB' }]}>
                <Ionicons name="book-outline" size={16} color={Colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.guideTitle}>Word Template Guide</Text>
                <Text style={styles.guideSubtitle}>Click to see name tags to use in Word</Text>
              </View>
            </View>
            <Ionicons
              name={showGuide ? 'chevron-up' : 'chevron-down'}
              size={18}
              color={Colors.textTertiary}
            />
          </TouchableOpacity>

          {showGuide && (
            <View style={styles.guideContent}>
              <Text style={styles.guideIntro}>
                Create custom billing templates in Microsoft Word! Put placeholder tags inside brackets (like <Text style={{ fontWeight: 'bold', fontFamily: 'monospace' }}>{"<PartyName>"}</Text>) anywhere in your document. The app automatically recognizes them:
              </Text>
              
              <Text style={styles.guideSectionTitle}>How to Create &amp; Customize:</Text>
              <View style={styles.stepsContainer}>
                <View style={styles.stepRow}>
                  <View style={styles.stepNumberCircle}><Text style={styles.stepNumberText}>1</Text></View>
                  <Text style={styles.stepText}>
                    <Text style={{ fontWeight: 'bold' }}>Download the Default Template:</Text> Tap the <Ionicons name="download-outline" size={13} color={Colors.primary} /> button on the <Text style={{ fontStyle: 'italic' }}>Standard Billing Template</Text> below to get a pre-configured Microsoft Word (.docx) file.
                  </Text>
                </View>
                <View style={styles.stepRow}>
                  <View style={styles.stepNumberCircle}><Text style={styles.stepNumberText}>2</Text></View>
                  <Text style={styles.stepText}>
                    <Text style={{ fontWeight: 'bold' }}>Customize in MS Word:</Text> Open the file in Word on your phone or PC. You can format the tables, add your shop logo, change colors, or adjust fonts.
                  </Text>
                </View>
                <View style={styles.stepRow}>
                  <View style={styles.stepNumberCircle}><Text style={styles.stepNumberText}>3</Text></View>
                  <Text style={styles.stepText}>
                    <Text style={{ fontWeight: 'bold' }}>Keep Placeholders Intact:</Text> Keep the tag names in angle brackets (e.g. <Text style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>{"<PartyName>"}</Text>). You can move them anywhere you like!
                  </Text>
                </View>
                <View style={styles.stepRow}>
                  <View style={styles.stepNumberCircle}><Text style={styles.stepNumberText}>4</Text></View>
                  <Text style={styles.stepText}>
                    <Text style={{ fontWeight: 'bold' }}>Save &amp; Upload:</Text> Save your design as a <Text style={{ fontWeight: 'bold' }}>.docx</Text> file, and tap the <Text style={{ fontWeight: 'bold', color: Colors.primary }}>Upload</Text> button in the top right of this screen!
                  </Text>
                </View>
              </View>

              <Text style={styles.guideSectionTitle}>Header Information Tags</Text>
              <View style={styles.tagGrid}>
                {[
                  { tag: '<BN>', desc: 'Bill Number / Invoice No' },
                  { tag: '<PartyName>', desc: 'Customer / Party / Client' },
                  { tag: '<BillDate>', desc: 'Billing Date / Date' },
                  { tag: '<DeliveryLoc>', desc: 'Delivery Place / Location' },
                ].map((item, idx) => (
                  <View key={idx} style={styles.guideItem}>
                    <Text style={styles.guideCode}>{item.tag}</Text>
                    <Text style={styles.guideDesc}>{item.desc}</Text>
                  </View>
                ))}
              </View>

              <Text style={styles.guideSectionTitle}>Table Column Tags (Line Items)</Text>
              <View style={styles.tagGrid}>
                {[
                  { tag: '<Sno>', desc: 'Serial Number / Index' },
                  { tag: '<DateTime>', desc: 'Date of loading / shipment' },
                  { tag: '<MaterialType>', desc: 'Materials description' },
                  { tag: '<Trip>', desc: 'Number of trips' },
                  { tag: '<Units>', desc: 'Number of units / quantity' },
                  { tag: '<Cal1s>', desc: 'Line Total (Auto-calculated)' },
                ].map((item, idx) => (
                  <View key={idx} style={styles.guideItem}>
                    <Text style={[styles.guideCode, { backgroundColor: '#FDF2E9', color: '#E67E22' }]}>{item.tag}</Text>
                    <Text style={styles.guideDesc}>{item.desc}</Text>
                  </View>
                ))}
              </View>

              <View style={styles.guideNoteBox}>
                <Ionicons name="information-circle-outline" size={16} color={Colors.info} style={{ marginRight: 6 }} />
                <Text style={styles.guideNoteText}>
                  Note: Placeholders are case-insensitive. You can customize labels, but keeping these exact tag labels enables automated sequence numbers, WhatsApp pre-fills, and calculations!
                </Text>
              </View>
            </View>
          )}
        </Card>

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
                      style={[styles.iconBtn, { backgroundColor: '#EEF2FF' }]}
                      onPress={() => handleExportTemplate(template)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Ionicons name="download-outline" size={18} color={Colors.primary} />
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
  guideCard: {
    marginBottom: Spacing.lg,
    padding: Spacing.md,
    backgroundColor: '#F8FAFC',
    borderColor: Colors.borderLight,
    borderWidth: 1.5,
  },
  guideHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  guideIconCircle: {
    width: 32,
    height: 32,
    borderRadius: BorderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  guideTitle: {
    ...Typography.bodySemibold,
    color: Colors.text,
  },
  guideSubtitle: {
    ...Typography.small,
    color: Colors.textTertiary,
    marginTop: 1,
  },
  guideContent: {
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
  },
  guideIntro: {
    ...Typography.body,
    color: Colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 6,
  },
  guideSectionTitle: {
    ...Typography.captionSemibold,
    color: Colors.primaryMid,
    marginTop: Spacing.sm,
    marginBottom: Spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  tagGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs + 2,
    marginBottom: Spacing.xs,
  },
  guideItem: {
    width: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.surface,
    padding: 6,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  guideCode: {
    ...Typography.small,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontWeight: '700',
    color: Colors.primaryLight,
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
  },
  guideDesc: {
    ...Typography.small,
    color: Colors.textSecondary,
    fontSize: 11,
    flex: 1,
  },
  guideNoteBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#EBF5FB',
    borderRadius: BorderRadius.sm,
    padding: Spacing.sm,
    marginTop: Spacing.md,
    borderWidth: 0.5,
    borderColor: 'rgba(52,152,219,0.2)',
  },
  guideNoteText: {
    ...Typography.small,
    color: Colors.info,
    fontSize: 11.5,
    lineHeight: 16,
    flex: 1,
  },
  stepsContainer: {
    marginTop: Spacing.xs,
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    backgroundColor: '#FFFFFF',
    padding: Spacing.sm,
    borderRadius: BorderRadius.sm,
    borderWidth: 0.5,
    borderColor: Colors.borderLight,
  },
  stepNumberCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  stepNumberText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: 'bold',
  },
  stepText: {
    ...Typography.small,
    color: Colors.textSecondary,
    fontSize: 11.5,
    lineHeight: 16,
    flex: 1,
  },
});
