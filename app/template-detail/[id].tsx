// @ts-nocheck
import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, Alert, Platform, Modal, Switch, TextInput,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius } from '../../src/theme';
import { Card, Button, Input } from '../../src/components';
import { getDatabase, getTemplateById, deleteTemplate } from '../../src/database/db';
import * as FileSystem from 'expo-file-system';
import { cacheDirectory, EncodingType } from 'expo-file-system';
import { shareAsync } from 'expo-sharing';
import { generateCustomTemplateDocxBase64 } from '../../src/services/templateParser';

export default function TemplateDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams();
  const [template, setTemplate] = useState(null);
  const [headerFields, setHeaderFields] = useState([]);
  const [tableFields, setTableFields] = useState([]);

  // Template Visual Designer states
  const [designerVisible, setDesignerVisible] = useState(false);
  const [designerSettings, setDesignerSettings] = useState({
    themeColor: '#0F2050',
    fontFamily: 'Arial',
    borderStyle: 'single',
    titleText: '',
  });
  const [designerHeaderFields, setDesignerHeaderFields] = useState([]);
  const [designerTableFields, setDesignerTableFields] = useState([]);
  const [designerActiveTab, setDesignerActiveTab] = useState('styles'); // 'styles', 'headers', 'columns'
  const [newFieldName, setNewFieldName] = useState('');
  const [newFieldType, setNewFieldType] = useState('text'); // 'text', 'numeric', 'date', 'time', 'datetime'

  const openDesigner = () => {
    setDesignerSettings({
      themeColor: template.theme_color || '#0F2050',
      fontFamily: template.font_family || 'Arial',
      borderStyle: template.border_style || 'single',
      titleText: template.name || 'Standard Billing Invoice',
    });
    setDesignerHeaderFields([...headerFields]);
    setDesignerTableFields([...tableFields]);
    setDesignerVisible(false);
    setDesignerActiveTab('styles');
    setNewFieldName('');
    setNewFieldType('text');
    setDesignerVisible(true);
  };

  const handleAddField = (targetType) => {
    if (!newFieldName.trim()) {
      Alert.alert('Required', 'Please enter a field name');
      return;
    }
    // Clean name
    const cleanedName = newFieldName.trim().replace(/[^A-Za-z0-9]/g, '');
    const label = newFieldName.trim();
    const newField = {
      name: cleanedName,
      type: newFieldType,
      label: label
    };

    if (targetType === 'header') {
      if (designerHeaderFields.some(f => f.name.toLowerCase() === cleanedName.toLowerCase())) {
        Alert.alert('Duplicate', 'A field with this name already exists.');
        return;
      }
      setDesignerHeaderFields([...designerHeaderFields, newField]);
    } else {
      if (designerTableFields.some(f => f.name.toLowerCase() === cleanedName.toLowerCase())) {
        Alert.alert('Duplicate', 'A column with this name already exists.');
        return;
      }
      setDesignerTableFields([...designerTableFields, newField]);
    }
    setNewFieldName('');
  };

  const handleRemoveField = (idx, targetType) => {
    if (targetType === 'header') {
      setDesignerHeaderFields(designerHeaderFields.filter((_, i) => i !== idx));
    } else {
      setDesignerTableFields(designerTableFields.filter((_, i) => i !== idx));
    }
  };

  const handleReorderField = (idx, direction, targetType) => {
    const list = targetType === 'header' ? [...designerHeaderFields] : [...designerTableFields];
    if (direction === 'up' && idx > 0) {
      const temp = list[idx];
      list[idx] = list[idx - 1];
      list[idx - 1] = temp;
    } else if (direction === 'down' && idx < list.length - 1) {
      const temp = list[idx];
      list[idx] = list[idx + 1];
      list[idx + 1] = temp;
    }
    
    if (targetType === 'header') {
      setDesignerHeaderFields(list);
    } else {
      setDesignerTableFields(list);
    }
  };

  const handleUpdateFieldLabel = (idx, newLabel, targetType) => {
    if (targetType === 'header') {
      const list = [...designerHeaderFields];
      list[idx].label = newLabel;
      setDesignerHeaderFields(list);
    } else {
      const list = [...designerTableFields];
      list[idx].label = newLabel;
      setDesignerTableFields(list);
    }
  };

  const saveDesignerChanges = async () => {
    try {
      const db = await getDatabase();
      const newDocx = generateCustomTemplateDocxBase64(designerSettings, designerHeaderFields, designerTableFields);
      
      if (db.isWeb) {
        const list = localStorage.getItem('billforge_templates');
        const parsedList = list ? JSON.parse(list) : [];
        const idx = parsedList.findIndex(t => t.id === parseInt(id));
        if (idx !== -1) {
          parsedList[idx] = {
            ...parsedList[idx],
            name: designerSettings.titleText,
            theme_color: designerSettings.themeColor,
            font_family: designerSettings.fontFamily,
            border_style: designerSettings.borderStyle,
            header_fields_json: JSON.stringify(designerHeaderFields),
            table_fields_json: JSON.stringify(designerTableFields),
            all_fields_json: JSON.stringify([...designerHeaderFields, ...designerTableFields]),
            file_base64: newDocx
          };
          localStorage.setItem('billforge_templates', JSON.stringify(parsedList));
        }
      } else {
        await db.runAsync(
          `UPDATE templates SET 
             name = ?,
             theme_color = ?,
             font_family = ?,
             border_style = ?,
             header_fields_json = ?,
             table_fields_json = ?,
             all_fields_json = ?,
             file_base64 = ?
           WHERE id = ?`,
          [
            designerSettings.titleText,
            designerSettings.themeColor,
            designerSettings.fontFamily,
            designerSettings.borderStyle,
            JSON.stringify(designerHeaderFields),
            JSON.stringify(designerTableFields),
            JSON.stringify([...designerHeaderFields, ...designerTableFields]),
            newDocx,
            parseInt(id)
          ]
        );
      }
      
      Alert.alert('Success', 'Template layout design saved successfully.');
      setDesignerVisible(false);
      loadTemplate();
    } catch (e) {
      console.error('Error saving template designer changes:', e);
      Alert.alert('Error', 'Failed to save template changes.');
    }
  };

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

  const handleExportTemplate = async () => {
    if (!template || !template.file_base64) {
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

  const normalize = (name) => name ? name.toLowerCase().replace(/[\s_-]/g, '') : '';
  const findField = (fields, targets) => fields.find(f => targets.includes(normalize(f.name)));

  // Identify standard fields
  const bnField = findField(designerHeaderFields, ['bn', 'billnumber']);
  const shopNameField = findField(designerHeaderFields, ['shopname', 'companyname']);
  const shopLocField = findField(designerHeaderFields, ['shoplocation', 'shopaddress', 'address']);
  const shopNumField = findField(designerHeaderFields, ['shopnumber', 'shopphone', 'phone']);
  const partyNameField = findField(designerHeaderFields, ['partyname', 'customername', 'clientname']);
  const billDateField = findField(designerHeaderFields, ['billdate', 'date']);
  const deliveryLocField = findField(designerHeaderFields, ['deliveryloc', 'place', 'location']);

  // Extract custom fields (non-standard fields)
  const standardNames = ['bn', 'billnumber', 'shopname', 'companyname', 'shoplocation', 'shopaddress', 'address', 'shopnumber', 'shopphone', 'phone', 'partyname', 'customername', 'clientname', 'billdate', 'date', 'deliveryloc', 'place', 'location', 'total'];
  const customHeaderFields = designerHeaderFields.filter(f => !standardNames.includes(normalize(f.name)));

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

        <View style={{ height: 12 }} />

        <Button
          title="Customize Template Design (Word Editor)"
          onPress={openDesigner}
          fullWidth
          size="lg"
          icon="color-filter-outline"
          variant="accent"
          style={styles.customizeBtn}
        />

        <View style={{ height: 12 }} />

        <Button
          title="Download Word Template File"
          onPress={handleExportTemplate}
          fullWidth
          size="lg"
          icon="download-outline"
          variant="outline"
          style={styles.downloadBtn}
        />

        <View style={{ height: 30 }} />
      </ScrollView>

      {/* Template Designer Modal */}
      <Modal
        visible={designerVisible}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setDesignerVisible(false)}
      >
        <View style={[styles.designerContainer, { paddingTop: insets.top }]}>
          {/* Header */}
          <View style={styles.designerHeader}>
            <TouchableOpacity onPress={() => setDesignerVisible(false)} style={styles.backBtn}>
              <Ionicons name="close" size={24} color={Colors.text} />
            </TouchableOpacity>
            <View style={styles.headerCenter}>
              <Text style={styles.headerTitle}>Template Designer</Text>
              <Text style={styles.headerSub}>Visual WYSIWYG layout builder</Text>
            </View>
            <Button
              title="Save Changes"
              onPress={saveDesignerChanges}
              variant="success"
              size="sm"
              icon="checkmark"
            />
          </View>

          {/* Designer Content */}
          <View style={styles.designerContent}>
            {/* Sidebar Controls */}
            <View style={styles.designerSidebar}>
              {/* Tab Selector */}
              <View style={styles.tabSelector}>
                <TouchableOpacity
                  style={[styles.tabButton, designerActiveTab === 'styles' && styles.tabButtonActive]}
                  onPress={() => setDesignerActiveTab('styles')}
                >
                  <Ionicons name="brush-outline" size={16} color={designerActiveTab === 'styles' ? Colors.accent : Colors.textSecondary} />
                  <Text style={[styles.tabButtonText, designerActiveTab === 'styles' && styles.tabButtonTextActive]}>Styles</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.tabButton, designerActiveTab === 'headers' && styles.tabButtonActive]}
                  onPress={() => setDesignerActiveTab('headers')}
                >
                  <Ionicons name="document-text-outline" size={16} color={designerActiveTab === 'headers' ? Colors.accent : Colors.textSecondary} />
                  <Text style={[styles.tabButtonText, designerActiveTab === 'headers' && styles.tabButtonTextActive]}>Header Fields</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.tabButton, designerActiveTab === 'columns' && styles.tabButtonActive]}
                  onPress={() => setDesignerActiveTab('columns')}
                >
                  <Ionicons name="grid-outline" size={16} color={designerActiveTab === 'columns' ? Colors.accent : Colors.textSecondary} />
                  <Text style={[styles.tabButtonText, designerActiveTab === 'columns' && styles.tabButtonTextActive]}>Columns</Text>
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.sidebarScroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                {/* styles tab */}
                {designerActiveTab === 'styles' && (
                  <View style={styles.sidebarSection}>
                    <Input
                      label="Template Title / Header"
                      value={designerSettings.titleText}
                      onChangeText={(val) => setDesignerSettings({ ...designerSettings, titleText: val })}
                      placeholder="e.g. Saravana Crusher"
                    />

                    {/* Font Selector */}
                    <Text style={styles.sidebarLabel}>Template Typography Font</Text>
                    <View style={styles.optionsGrid}>
                      {['Arial', 'Georgia', 'Times New Roman', 'Courier New'].map(font => (
                        <TouchableOpacity
                          key={font}
                          style={[styles.optionCard, designerSettings.fontFamily === font && styles.optionCardActive]}
                          onPress={() => setDesignerSettings({ ...designerSettings, fontFamily: font })}
                        >
                          <Text style={[styles.optionCardText, { fontFamily: font === 'Times New Roman' ? 'serif' : font === 'Courier New' ? 'monospace' : 'sans-serif' }, designerSettings.fontFamily === font && styles.optionCardTextActive]}>
                            {font}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    {/* Accent Color Selector */}
                    <Text style={styles.sidebarLabel}>Theme Accent Color</Text>
                    <View style={styles.optionsGrid}>
                      {[
                        { name: 'Navy', hex: '#0F2050' },
                        { name: 'Emerald', hex: '#0E7850' },
                        { name: 'Crimson', hex: '#C0303A' },
                        { name: 'Sapphire', hex: '#2952B3' },
                        { name: 'Charcoal', hex: '#2C3E50' },
                      ].map(color => (
                        <TouchableOpacity
                          key={color.hex}
                          style={[styles.colorOption, designerSettings.themeColor === color.hex && styles.colorOptionActive]}
                          onPress={() => setDesignerSettings({ ...designerSettings, themeColor: color.hex })}
                        >
                          <View style={[styles.colorDot, { backgroundColor: color.hex }]} />
                          <Text style={[styles.colorOptionText, designerSettings.themeColor === color.hex && styles.colorOptionTextActive]}>
                            {color.name}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    {/* Border Style Selector */}
                    <Text style={styles.sidebarLabel}>Table Borders Layout</Text>
                    <View style={styles.optionsGrid}>
                      {[
                        { name: 'Classic Solid', val: 'single' },
                        { name: 'Formal Double', val: 'double' },
                        { name: 'Fine Clean', val: 'fine' },
                        { name: 'Modern Borderless', val: 'none' },
                      ].map(border => (
                        <TouchableOpacity
                          key={border.val}
                          style={[styles.optionCard, designerSettings.borderStyle === border.val && styles.optionCardActive]}
                          onPress={() => setDesignerSettings({ ...designerSettings, borderStyle: border.val })}
                        >
                          <Text style={[styles.optionCardText, designerSettings.borderStyle === border.val && styles.optionCardTextActive]}>
                            {border.name}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                )}

                {/* header fields tab */}
                {designerActiveTab === 'headers' && (
                  <View style={styles.sidebarSection}>
                    <Text style={styles.sidebarDesc}>Manage what information fields appear in the bill's top area.</Text>
                    
                    <View style={styles.addFieldBox}>
                      <Text style={styles.sidebarSubLabel}>Add Custom Field</Text>
                      <TextInput
                        style={styles.sidebarInput}
                        value={newFieldName}
                        onChangeText={setNewFieldName}
                        placeholder="e.g. GSTIN or ProjectRef"
                      />
                      <View style={styles.typeSelectorRow}>
                        {['text', 'numeric', 'date', 'datetime'].map(t => (
                          <TouchableOpacity
                            key={t}
                            style={[styles.typePill, newFieldType === t && styles.typePillActive]}
                            onPress={() => setNewFieldType(t)}
                          >
                            <Text style={[styles.typePillText, newFieldType === t && styles.typePillTextActive]}>{t.toUpperCase()}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                      <Button
                        title="Add Field"
                        onPress={() => handleAddField('header')}
                        size="sm"
                        icon="add"
                      />
                    </View>

                    <Text style={styles.sidebarLabel}>Header Fields List</Text>
                    {designerHeaderFields.map((field, idx) => (
                      <View key={field.name} style={styles.designerFieldItem}>
                        <View style={styles.fieldReorderBtns}>
                          <TouchableOpacity onPress={() => handleReorderField(idx, 'up', 'header')} disabled={idx === 0}>
                            <Ionicons name="chevron-up" size={18} color={idx === 0 ? Colors.textDisabled : Colors.textSecondary} />
                          </TouchableOpacity>
                          <TouchableOpacity onPress={() => handleReorderField(idx, 'down', 'header')} disabled={idx === designerHeaderFields.length - 1}>
                            <Ionicons name="chevron-down" size={18} color={idx === designerHeaderFields.length - 1 ? Colors.textDisabled : Colors.textSecondary} />
                          </TouchableOpacity>
                        </View>
                        <View style={{ flex: 1, marginHorizontal: 8 }}>
                          <TextInput
                            style={styles.fieldLabelInput}
                            value={field.label}
                            onChangeText={(val) => handleUpdateFieldLabel(idx, val, 'header')}
                          />
                          <Text style={styles.fieldCodeText}>&lt;{field.name}&gt;</Text>
                        </View>
                        <TouchableOpacity onPress={() => handleRemoveField(idx, 'header')} style={styles.removeFieldIcon}>
                          <Ionicons name="trash-outline" size={16} color={Colors.danger} />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                )}

                {/* table columns tab */}
                {designerActiveTab === 'columns' && (
                  <View style={styles.sidebarSection}>
                    <Text style={styles.sidebarDesc}>Adjust what columns are visible in the repeat items grid.</Text>
                    
                    <View style={styles.addFieldBox}>
                      <Text style={styles.sidebarSubLabel}>Add Table Column</Text>
                      <TextInput
                        style={styles.sidebarInput}
                        value={newFieldName}
                        onChangeText={setNewFieldName}
                        placeholder="e.g. UnitPrice or Hours"
                      />
                      <View style={styles.typeSelectorRow}>
                        {['text', 'numeric', 'date'].map(t => (
                          <TouchableOpacity
                            key={t}
                            style={[styles.typePill, newFieldType === t && styles.typePillActive]}
                            onPress={() => setNewFieldType(t)}
                          >
                            <Text style={[styles.typePillText, newFieldType === t && styles.typePillTextActive]}>{t.toUpperCase()}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                      <Button
                        title="Add Column"
                        onPress={() => handleAddField('table')}
                        size="sm"
                        icon="add"
                      />
                    </View>

                    <Text style={styles.sidebarLabel}>Table Columns List</Text>
                    {designerTableFields.map((field, idx) => (
                      <View key={field.name} style={styles.designerFieldItem}>
                        <View style={styles.fieldReorderBtns}>
                          <TouchableOpacity onPress={() => handleReorderField(idx, 'up', 'table')} disabled={idx === 0}>
                            <Ionicons name="chevron-up" size={18} color={idx === 0 ? Colors.textDisabled : Colors.textSecondary} />
                          </TouchableOpacity>
                          <TouchableOpacity onPress={() => handleReorderField(idx, 'down', 'table')} disabled={idx === designerTableFields.length - 1}>
                            <Ionicons name="chevron-down" size={18} color={idx === designerTableFields.length - 1 ? Colors.textDisabled : Colors.textSecondary} />
                          </TouchableOpacity>
                        </View>
                        <View style={{ flex: 1, marginHorizontal: 8 }}>
                          <TextInput
                            style={styles.fieldLabelInput}
                            value={field.label}
                            onChangeText={(val) => handleUpdateFieldLabel(idx, val, 'table')}
                          />
                          <Text style={styles.fieldCodeText}>&lt;{field.name}&gt;</Text>
                        </View>
                        <TouchableOpacity onPress={() => handleRemoveField(idx, 'table')} style={styles.removeFieldIcon}>
                          <Ionicons name="trash-outline" size={16} color={Colors.danger} />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                )}
              </ScrollView>
            </View>

            {/* A4 Live Sandbox Canvas */}
            <View style={styles.designerCanvas}>
              <Text style={styles.canvasHeaderTitle}>A4 Interactive Visual Sandbox</Text>
              
              <ScrollView contentContainerStyle={{ paddingBottom: 20 }} showsVerticalScrollIndicator={false}>
                <View style={[styles.canvasA4Paper, { borderColor: designerSettings.themeColor }]}>
                  {/* Shop Details Header Block */}
                  <View style={styles.canvasShopHeader}>
                    {/* Top Row with BN, ShopName, ShopNumber */}
                    <View style={styles.canvasShopHeaderTop}>
                      {/* Left: BN */}
                      <View style={styles.canvasBnContainer}>
                        {bnField ? (
                          <Text style={[styles.canvasBnText, { fontFamily: designerSettings.fontFamily === 'Times New Roman' ? 'serif' : designerSettings.fontFamily === 'Courier New' ? 'monospace' : 'sans-serif' }]}>
                            &lt;{bnField.name}&gt;
                          </Text>
                        ) : (
                          <Text style={styles.canvasMissingFieldPlaceholder}>&lt;BN&gt;</Text>
                        )}
                      </View>

                      {/* Center: Shop Name */}
                      <View style={styles.canvasShopNameContainer}>
                        {shopNameField ? (
                          <Text style={[styles.canvasShopNameText, { color: designerSettings.themeColor, fontFamily: designerSettings.fontFamily === 'Times New Roman' ? 'serif' : designerSettings.fontFamily === 'Courier New' ? 'monospace' : 'sans-serif' }]}>
                            &lt;{shopNameField.name}&gt;
                          </Text>
                        ) : (
                          <TextInput
                            style={[styles.canvasShopNameInput, { color: designerSettings.themeColor, fontFamily: designerSettings.fontFamily === 'Times New Roman' ? 'serif' : designerSettings.fontFamily === 'Courier New' ? 'monospace' : 'sans-serif' }]}
                            value={designerSettings.titleText}
                            onChangeText={(val) => setDesignerSettings({ ...designerSettings, titleText: val })}
                            placeholder="&lt;ShopName&gt;"
                          />
                        )}
                      </View>

                      {/* Right: Shop Number */}
                      <View style={styles.canvasShopNumContainer}>
                        {shopNumField ? (
                          <Text style={[styles.canvasShopNumText, { fontFamily: designerSettings.fontFamily === 'Times New Roman' ? 'serif' : designerSettings.fontFamily === 'Courier New' ? 'monospace' : 'sans-serif' }]}>
                            📞 &lt;{shopNumField.name}&gt;
                          </Text>
                        ) : (
                          <Text style={styles.canvasMissingFieldPlaceholder}>📞 &lt;ShopNumber&gt;</Text>
                        )}
                      </View>
                    </View>

                    {/* Sub-header Center: Shop Location */}
                    <View style={styles.canvasShopLocContainer}>
                      {shopLocField ? (
                        <Text style={[styles.canvasShopLocText, { fontFamily: designerSettings.fontFamily === 'Times New Roman' ? 'serif' : designerSettings.fontFamily === 'Courier New' ? 'monospace' : 'sans-serif' }]}>
                          &lt;{shopLocField.name}&gt;
                        </Text>
                      ) : (
                        <Text style={styles.canvasMissingFieldPlaceholder}>&lt;ShopLocation&gt;</Text>
                      )}
                    </View>
                  </View>

                  {/* Horizontal Divider Line */}
                  <View style={[styles.canvasDividerLine, { backgroundColor: designerSettings.themeColor }]} />

                  {/* Customer / Party details grid */}
                  <View style={styles.canvasCustomerDetailsGrid}>
                    {/* Left side: Party Name */}
                    <View style={styles.canvasPartyNameContainer}>
                      <Text style={[styles.canvasPartyLabel, { fontFamily: designerSettings.fontFamily === 'Times New Roman' ? 'serif' : designerSettings.fontFamily === 'Courier New' ? 'monospace' : 'sans-serif' }]}>M/s:</Text>
                      <View style={styles.canvasSolidUnderline}>
                        {partyNameField ? (
                          <Text style={[styles.canvasPlaceholderVal, { fontFamily: designerSettings.fontFamily === 'Times New Roman' ? 'serif' : designerSettings.fontFamily === 'Courier New' ? 'monospace' : 'sans-serif' }]}>&lt;{partyNameField.name}&gt;</Text>
                        ) : (
                          <Text style={styles.canvasMissingFieldPlaceholder}>&lt;PartyName&gt;</Text>
                        )}
                      </View>
                    </View>

                    {/* Right side: Date and Place */}
                    <View style={styles.canvasDatePlaceContainer}>
                      <View style={styles.canvasDateRow}>
                        <Text style={[styles.canvasPartyLabel, { fontFamily: designerSettings.fontFamily === 'Times New Roman' ? 'serif' : designerSettings.fontFamily === 'Courier New' ? 'monospace' : 'sans-serif' }]}>Date:</Text>
                        <View style={styles.canvasSolidUnderlineShort}>
                          {billDateField ? (
                            <Text style={[styles.canvasPlaceholderVal, { fontFamily: designerSettings.fontFamily === 'Times New Roman' ? 'serif' : designerSettings.fontFamily === 'Courier New' ? 'monospace' : 'sans-serif' }]}>&lt;{billDateField.name}&gt;</Text>
                          ) : (
                            <Text style={styles.canvasMissingFieldPlaceholder}>&lt;BillDate&gt;</Text>
                          )}
                        </View>
                      </View>

                      <View style={[styles.canvasDateRow, { marginTop: 6 }]}>
                        <Text style={[styles.canvasPartyLabel, { fontFamily: designerSettings.fontFamily === 'Times New Roman' ? 'serif' : designerSettings.fontFamily === 'Courier New' ? 'monospace' : 'sans-serif' }]}>Place:</Text>
                        <View style={styles.canvasSolidUnderlineShort}>
                          {deliveryLocField ? (
                            <Text style={[styles.canvasPlaceholderVal, { fontFamily: designerSettings.fontFamily === 'Times New Roman' ? 'serif' : designerSettings.fontFamily === 'Courier New' ? 'monospace' : 'sans-serif' }]}>&lt;{deliveryLocField.name}&gt;</Text>
                          ) : (
                            <Text style={styles.canvasMissingFieldPlaceholder}>&lt;DeliveryLoc&gt;</Text>
                          )}
                        </View>
                      </View>
                    </View>
                  </View>

                  {/* Render Custom Header Fields if any */}
                  {customHeaderFields.length > 0 && (
                    <View style={[styles.canvasCustomHeaderGrid, { borderColor: designerSettings.themeColor }]}>
                      {customHeaderFields.map((field) => (
                        <View key={field.name} style={styles.canvasCustomHeaderItem}>
                          <Text style={[styles.canvasCustomHeaderLabel, { fontFamily: designerSettings.fontFamily === 'Times New Roman' ? 'serif' : designerSettings.fontFamily === 'Courier New' ? 'monospace' : 'sans-serif' }]}>{field.label}:</Text>
                          <Text style={[styles.canvasCustomHeaderVal, { fontFamily: designerSettings.fontFamily === 'Times New Roman' ? 'serif' : designerSettings.fontFamily === 'Courier New' ? 'monospace' : 'sans-serif' }]}>&lt;{field.name}&gt;</Text>
                        </View>
                      ))}
                    </View>
                  )}

                  {/* Columns Grid Table */}
                  <View style={[styles.canvasTable, { borderColor: designerSettings.themeColor, borderWidth: designerSettings.borderStyle === 'none' ? 0 : 1 }]}>
                    <View style={[styles.canvasTableHeader, { borderBottomColor: designerSettings.themeColor, borderBottomWidth: 1, backgroundColor: '#F8FAFC' }]}>
                      {designerTableFields.map((field) => (
                        <View key={field.name} style={[styles.canvasTableHeaderCell, { borderColor: designerSettings.themeColor, borderRightWidth: designerSettings.borderStyle === 'none' ? 0 : 1 }]}>
                          <TextInput
                            style={[styles.canvasTableHeaderText, { color: designerSettings.themeColor, fontFamily: designerSettings.fontFamily === 'Times New Roman' ? 'serif' : designerSettings.fontFamily === 'Courier New' ? 'monospace' : 'sans-serif' }]}
                            value={field.label}
                            onChangeText={(val) => {
                              const idx = designerTableFields.findIndex(f => f.name === field.name);
                              if (idx !== -1) handleUpdateFieldLabel(idx, val, 'table');
                            }}
                          />
                        </View>
                      ))}
                    </View>

                    {[1, 2].map(rowNum => (
                      <View key={rowNum} style={[styles.canvasTableRow, { borderBottomColor: designerSettings.themeColor, borderBottomWidth: designerSettings.borderStyle === 'none' ? 0 : 1 }]}>
                        {designerTableFields.map((field) => (
                          <View key={field.name} style={[styles.canvasTableCell, { borderColor: designerSettings.themeColor, borderRightWidth: designerSettings.borderStyle === 'none' ? 0 : 1 }]}>
                            <Text style={[styles.canvasTableCellText, { fontFamily: designerSettings.fontFamily === 'Times New Roman' ? 'serif' : designerSettings.fontFamily === 'Courier New' ? 'monospace' : 'sans-serif' }]}>
                              &lt;{field.name}&gt;
                            </Text>
                          </View>
                        ))}
                      </View>
                    ))}
                    {designerTableFields.length === 0 && (
                      <Text style={styles.canvasEmptyFieldsTip}>No table columns. Go to the "Columns" tab to add them!</Text>
                    )}

                    {/* Table total footer row */}
                    {designerTableFields.length > 0 && (
                      <View style={[styles.canvasTableRow, { backgroundColor: '#F8FAFC' }]}>
                        {designerTableFields.map((field, idx) => {
                          const isLast = idx === designerTableFields.length - 1;
                          const isSecondLast = idx === designerTableFields.length - 2;
                          return (
                            <View key={field.name + '_total'} style={[styles.canvasTableCell, { borderColor: designerSettings.themeColor, borderRightWidth: designerSettings.borderStyle === 'none' ? 0 : 1, borderTopWidth: 1, borderTopColor: designerSettings.themeColor }]}>
                              {isSecondLast ? (
                                <Text style={[styles.canvasTableHeaderText, { color: designerSettings.themeColor, fontWeight: 'bold', fontFamily: designerSettings.fontFamily === 'Times New Roman' ? 'serif' : designerSettings.fontFamily === 'Courier New' ? 'monospace' : 'sans-serif' }]}>
                                  Total
                                </Text>
                              ) : isLast ? (
                                <Text style={[styles.canvasTableCellText, { fontWeight: 'bold', color: '#000', fontFamily: designerSettings.fontFamily === 'Times New Roman' ? 'serif' : designerSettings.fontFamily === 'Courier New' ? 'monospace' : 'sans-serif' }]}>
                                  &lt;Total&gt;
                                </Text>
                              ) : null}
                            </View>
                          );
                        })}
                      </View>
                    )}
                  </View>

                  {/* Signature Section */}
                  <View style={styles.canvasSignatureSection}>
                    <Text style={[styles.canvasSignatureText, { fontFamily: designerSettings.fontFamily === 'Times New Roman' ? 'serif' : designerSettings.fontFamily === 'Courier New' ? 'monospace' : 'sans-serif' }]}>
                      Receiver's Signature: _________________________
                    </Text>
                  </View>
                </View>
              </ScrollView>
            </View>
          </View>
        </View>
      </Modal>
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
  customizeBtn: {
    backgroundColor: Colors.accent,
  },
  designerContainer: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  designerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  designerContent: {
    flex: 1,
    flexDirection: Platform.OS === 'web' ? 'row' : 'column',
  },
  designerSidebar: {
    width: Platform.OS === 'web' ? 360 : '100%',
    backgroundColor: Colors.surface,
    borderRightWidth: Platform.OS === 'web' ? 1 : 0,
    borderRightColor: Colors.borderLight,
    borderBottomWidth: Platform.OS === 'web' ? 0 : 1,
    borderBottomColor: Colors.borderLight,
  },
  designerCanvas: {
    flex: 1,
    backgroundColor: '#EAEDF1',
    padding: Spacing.lg,
  },
  canvasHeaderTitle: {
    ...Typography.bodySemibold,
    color: Colors.textSecondary,
    marginBottom: Spacing.md,
    textAlign: 'center',
  },
  canvasA4Paper: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1.5,
    minHeight: 520,
    padding: 30,
    shadowColor: 'rgba(0,0,0,0.1)',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 1,
    shadowRadius: 16,
    elevation: 4,
    maxWidth: 720,
    alignSelf: 'center',
    width: '100%',
  },
  canvasShopHeader: {
    marginBottom: 10,
  },
  canvasShopHeaderTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    width: '100%',
  },
  canvasBnContainer: {
    width: '20%',
  },
  canvasBnText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#000',
  },
  canvasShopNameContainer: {
    width: '60%',
    alignItems: 'center',
  },
  canvasShopNameText: {
    fontSize: 22,
    fontWeight: '900',
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  canvasShopNameInput: {
    fontSize: 20,
    fontWeight: '900',
    textAlign: 'center',
    width: '100%',
  },
  canvasShopNumContainer: {
    width: '20%',
    alignItems: 'flex-end',
  },
  canvasShopNumText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#000',
  },
  canvasShopLocContainer: {
    alignItems: 'center',
    marginTop: 4,
    width: '100%',
  },
  canvasShopLocText: {
    fontSize: 12,
    fontWeight: 'bold',
    textAlign: 'center',
    color: '#000',
  },
  canvasMissingFieldPlaceholder: {
    fontSize: 11,
    color: '#94A3B8',
    fontStyle: 'italic',
  },
  canvasDividerLine: {
    height: 1.5,
    width: '100%',
    marginVertical: 12,
  },
  canvasCustomerDetailsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 20,
  },
  canvasPartyNameContainer: {
    width: '60%',
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  canvasPartyLabel: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#000',
    marginRight: 6,
  },
  canvasSolidUnderline: {
    flex: 1,
    borderBottomWidth: 1,
    borderBottomColor: '#000',
    paddingBottom: 2,
  },
  canvasDatePlaceContainer: {
    width: '35%',
  },
  canvasDateRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  canvasSolidUnderlineShort: {
    flex: 1,
    borderBottomWidth: 1,
    borderBottomColor: '#000',
    paddingBottom: 2,
  },
  canvasPlaceholderVal: {
    fontSize: 11,
    color: '#777',
    fontStyle: 'italic',
  },
  canvasCustomHeaderGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    borderWidth: 1,
    padding: 10,
    borderRadius: 4,
    marginBottom: 15,
    gap: 8,
  },
  canvasCustomHeaderItem: {
    width: '48%',
    flexDirection: 'row',
    alignItems: 'center',
  },
  canvasCustomHeaderLabel: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#333',
    marginRight: 6,
  },
  canvasCustomHeaderVal: {
    fontSize: 11,
    color: '#555',
  },
  canvasTable: {
    borderRadius: 4,
    overflow: 'hidden',
  },
  canvasTableHeader: {
    flexDirection: 'row',
  },
  canvasTableHeaderCell: {
    flex: 1,
    padding: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  canvasTableHeaderText: {
    fontSize: 11,
    fontWeight: 'bold',
    textAlign: 'center',
    width: '90%',
    padding: 2,
  },
  canvasTableRow: {
    flexDirection: 'row',
  },
  canvasTableCell: {
    flex: 1,
    padding: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  canvasTableCellText: {
    fontSize: 10,
    color: '#777',
  },
  canvasEmptyFieldsTip: {
    ...Typography.caption,
    color: Colors.textTertiary,
    textAlign: 'center',
    fontStyle: 'italic',
    padding: 20,
  },
  canvasSignatureSection: {
    marginTop: 40,
    alignItems: 'flex-start',
    width: '100%',
  },
  canvasSignatureText: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#000',
  },
  tabSelector: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 6,
  },
  tabButtonActive: {
    borderBottomWidth: 2,
    borderBottomColor: Colors.accent,
  },
  tabButtonText: {
    ...Typography.captionSemibold,
    color: Colors.textSecondary,
  },
  tabButtonTextActive: {
    color: Colors.accent,
  },
  sidebarScroll: {
    flex: 1,
  },
  sidebarSection: {
    padding: Spacing.lg,
  },
  sidebarLabel: {
    ...Typography.captionSemibold,
    color: Colors.text,
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  sidebarSubLabel: {
    ...Typography.captionSemibold,
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
  },
  sidebarDesc: {
    ...Typography.caption,
    color: Colors.textTertiary,
    marginBottom: Spacing.md,
  },
  optionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: Spacing.md,
  },
  optionCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionCardActive: {
    borderColor: Colors.accent,
    backgroundColor: '#FFFFFF',
  },
  optionCardText: {
    ...Typography.captionSemibold,
    color: Colors.textSecondary,
  },
  optionCardTextActive: {
    color: Colors.accent,
  },
  colorOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    width: '47%',
  },
  colorOptionActive: {
    borderColor: Colors.accent,
    backgroundColor: '#FFFFFF',
  },
  colorDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    marginRight: 8,
  },
  colorOptionText: {
    ...Typography.captionSemibold,
    color: Colors.textSecondary,
  },
  colorOptionTextActive: {
    color: Colors.accent,
  },
  addFieldBox: {
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
  },
  sidebarInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    minHeight: 40,
    fontSize: 13,
    marginBottom: Spacing.sm,
    color: Colors.text,
  },
  typeSelectorRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: Spacing.md,
  },
  typePill: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.full,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  typePillActive: {
    borderColor: Colors.accent,
    backgroundColor: Colors.accentSurface,
  },
  typePillText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: Colors.textSecondary,
  },
  typePillTextActive: {
    color: Colors.accent,
  },
  designerFieldItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: Colors.borderLight,
    borderRadius: BorderRadius.md,
    padding: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  fieldReorderBtns: {
    flexDirection: 'column',
    alignItems: 'center',
    gap: 4,
  },
  fieldLabelInput: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    paddingVertical: 2,
  },
  fieldCodeText: {
    fontSize: 10,
    color: Colors.textTertiary,
    fontFamily: 'monospace',
    marginTop: 2,
  },
  removeFieldIcon: {
    padding: 6,
  },
});
