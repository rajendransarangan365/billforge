// @ts-nocheck
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, KeyboardAvoidingView, Platform, TextInput, Modal, Switch,
  Animated, Dimensions,
} from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius } from '../../src/theme';
import { Card, Button, Input, DateTimePickerInput } from '../../src/components';
import {
  getDatabase,
  getNextBillNumber,
  saveBill,
  getMaterials,
  saveMaterial,
  saveCustomer,
  getCustomers,
  getEnquiries,
  getCompanyProfile,
  getBillById,
  saveDraft,
  getDraft,
  clearDraft,
  minimizeDraft,
  getTemplateById,
  updateBillPdfUri,
} from '../../src/database/db';
import { getKeyboardTypeForField } from '../../src/services/templateParser';
import { generatePDF, sharePDF, savePDFPermanently } from '../../src/services/pdfGenerator';
import { useAuth } from '../../src/context/AuthContext';
import { useToast } from '../../src/context/ToastContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const STEPS = [
  { id: 0, label: 'Bill Info',     icon: 'document-text-outline',  color: '#6366F1' },
  { id: 1, label: 'Date & Place',  icon: 'calendar-outline',        color: '#8B5CF6' },
  { id: 2, label: 'Materials',     icon: 'cube-outline',            color: '#F59E0B' },
  { id: 3, label: 'Payments',      icon: 'cash-outline',            color: '#10B981' },
  { id: 4, label: 'Settings',      icon: 'settings-outline',        color: '#3B82F6' },
  { id: 5, label: 'Summary',       icon: 'calculator-outline',      color: '#EC4899' },
  { id: 6, label: 'Preview',       icon: 'eye-outline',             color: '#0EA5E9' },
  { id: 7, label: 'Save',          icon: 'save-outline',            color: '#22C55E' },
];

const normalizeKey = (key) => key ? key.toLowerCase().replace(/[\s_-]/g, '') : '';

const getRowValue = (row, targetNames) => {
  const normalizedTargets = targetNames.map(t => normalizeKey(t));
  const matchedKey = Object.keys(row).find(k => normalizedTargets.includes(normalizeKey(k)));
  return matchedKey ? row[matchedKey] : undefined;
};

function formatIndianNumber(num) {
  if (num === null || num === undefined || isNaN(num)) return '0';
  const n = Number(num);
  if (isNaN(n)) return '0';
  const numStr = Number.isInteger(n) ? n.toString() : parseFloat(n.toFixed(2)).toString();
  const parts = numStr.split('.');
  const isNegative = parts[0].startsWith('-');
  const intStr = isNegative ? parts[0].slice(1) : parts[0];
  let result = '';
  let count = 0;
  for (let i = intStr.length - 1; i >= 0; i--) {
    if (count === 3 || (count > 3 && (count - 3) % 2 === 0)) result = ',' + result;
    result = intStr[i] + result;
    count++;
  }
  if (isNegative) result = '-' + result;
  if (parts.length > 1 && parts[1]) result = `${result}.${parts[1]}`;
  return result;
}

function formatDate(isoString) {
  if (!isoString) return '';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return String(isoString);
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch { return String(isoString); }
}

// ─── Step Progress Bar ────────────────────────────────────────────────────────
function StepProgressBar({ currentStep, totalSteps, onStepPress }) {
  return (
    <View style={styles.progressBarContainer}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.progressBarScroll}>
        {STEPS.map((step, idx) => {
          const isCompleted = idx < currentStep;
          const isActive = idx === currentStep;
          return (
            <TouchableOpacity
              key={step.id}
              style={styles.progressStep}
              onPress={() => onStepPress(idx)}
              activeOpacity={0.7}
            >
              <View style={[
                styles.progressDot,
                isCompleted && styles.progressDotCompleted,
                isActive && styles.progressDotActive,
              ]}>
                {isCompleted
                  ? <Ionicons name="checkmark" size={14} color="#fff" />
                  : <Text style={[styles.progressDotText, isActive && styles.progressDotTextActive]}>{idx + 1}</Text>
                }
              </View>
              <Text style={[
                styles.progressLabel,
                isActive && styles.progressLabelActive,
                isCompleted && styles.progressLabelCompleted,
              ]} numberOfLines={1}>
                {step.label}
              </Text>
              {idx < totalSteps - 1 && (
                <View style={[styles.progressConnector, isCompleted && styles.progressConnectorCompleted]} />
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function BillFormScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { quarryId, user } = useAuth();
  const { showToast } = useToast();
  const companyId = quarryId || user?.quarry_id || 1;
  const { templateId, editBillId } = useLocalSearchParams();

  // ── Wizard State ──
  const [currentStep, setCurrentStep] = useState(0);

  // ── Template & Data State ──
  const [template, setTemplate] = useState(null);
  const [headerFields, setHeaderFields] = useState([]);
  const [tableFields, setTableFields] = useState([]);
  const [headerData, setHeaderData] = useState({});
  const [rowData, setRowData] = useState([{}]);
  const [companyProfile, setCompanyProfile] = useState({});
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [draftModalVisible, setDraftModalVisible] = useState(false);
  const [savedDraftData, setSavedDraftData] = useState(null);
  const [whatsappModalVisible, setWhatsappModalVisible] = useState(false);
  const [whatsappPhone, setWhatsappPhone] = useState('');
  const [sharingWhatsApp, setSharingWhatsApp] = useState(false);

  // ── Calc Settings (no multiplyTrip) ──
  const [calcSettings, setCalcSettings] = useState({
    includeTax: false,
    taxRate: 18,
    showTimeInTable: false,
  });

  // ── Payment entries (multiple) ──
  const [balanceEntries, setBalanceEntries] = useState([{ amount: '', date: new Date().toISOString(), note: '' }]);
  const [paidEntries, setPaidEntries] = useState([{ amount: '', date: new Date().toISOString(), note: '' }]);

  // ── Customer State ──
  const [customers, setCustomers] = useState([]);
  const [customerModalVisible, setCustomerModalVisible] = useState(false);
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [customerSearchQuery, setCustomerSearchQuery] = useState('');
  const [activeCustomerField, setActiveCustomerField] = useState('');
  const [showAddCustomerForm, setShowAddCustomerForm] = useState(false);
  const [newCustName, setNewCustName] = useState('');
  const [newCustPhone, setNewCustPhone] = useState('');
  const [newCustAddress, setNewCustAddress] = useState('');
  const [savingNewCustomer, setSavingNewCustomer] = useState(false);

  // ── Material State ──
  const [materials, setMaterials] = useState([]);
  const [materialModalVisible, setMaterialModalVisible] = useState(false);
  const [activeRowIdx, setActiveRowIdx] = useState(null);
  const [activeFieldKey, setActiveFieldKey] = useState('');
  const [customMaterialInput, setCustomMaterialInput] = useState('');
  const [customPriceInput, setCustomPriceInput] = useState('');
  const [customUnitInput, setCustomUnitInput] = useState('unit');
  const [showCustomMaterialForm, setShowCustomMaterialForm] = useState(false);
  const [savingCustomMaterial, setSavingCustomMaterial] = useState(false);

  const targetEditId = editBillId ? (Array.isArray(editBillId) ? editBillId[0] : editBillId) : null;

  // ── Load Data ──
  useEffect(() => {
    loadTemplate();
    loadMaterials();
    loadCustomers();
  }, [templateId, companyId, editBillId]);

  // Keyboard shortcuts (web)
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleSaveBill();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [headerData, rowData, calcSettings, companyProfile, saving, generating, companyId]);

  const loadCustomers = async () => {
    try {
      const db = await getDatabase();
      const list = await getCustomers(db, companyId);
      const enquiries = await getEnquiries(db, companyId);
      const combined = [...list];
      for (const e of enquiries) {
        if (e.customer_name && e.customer_name.trim() !== '') {
          const exists = combined.some(c => c.name.toLowerCase() === e.customer_name.toLowerCase());
          if (!exists) {
            combined.push({
              id: `enq_${e.id}`,
              name: e.customer_name,
              phone: e.customer_phone || '',
              address: e.customer_address || e.pickup_address || '',
              isEnquiry: true,
              enquiryStatus: e.status,
            });
          }
        }
      }
      setCustomers(combined);
    } catch (error) { console.error('Error loading customers:', error); }
  };

  const loadMaterials = async () => {
    try {
      const db = await getDatabase();
      const list = await getMaterials(db, companyId);
      setMaterials(list);
    } catch (error) { console.error('Error loading materials:', error); }
  };

  const loadTemplate = async () => {
    try {
      const db = await getDatabase();
      const rawId = Array.isArray(templateId) ? templateId[0] : templateId;
      const targetId = parseInt(rawId || '1') || 1;
      let t = await getTemplateById(db, targetId, companyId);
      if (!t) {
        const list = await getTemplates(db, companyId);
        t = (list && list.length > 0) ? list[0] : null;
      }
      if (t) {
        setTemplate(t);
        const hFields = typeof t.header_fields_json === 'string' ? JSON.parse(t.header_fields_json || '[]') : (t.header_fields_json || []);
        let tFields = typeof t.table_fields_json === 'string' ? JSON.parse(t.table_fields_json || '[]') : (t.table_fields_json || []);

        const hasCostField = tFields.some(f => {
          const norm = normalizeKey(f.name);
          return norm.includes('cost') || norm.includes('rate') || norm.includes('price') || norm.includes('value');
        });
        if (!hasCostField) {
          const matIdx = tFields.findIndex(f => ['materialtype', 'materialstype', 'material', 'materials'].includes(normalizeKey(f.name)));
          const virtualCostField = { name: 'MaterialTypeCost', label: 'Price per Unit (₹)', type: 'numeric', isVirtual: true };
          if (matIdx !== -1) tFields.splice(matIdx + 1, 0, virtualCostField);
          else tFields.push(virtualCostField);
        }

        setHeaderFields(hFields);
        setTableFields(tFields);
        const profile = await getCompanyProfile(db, companyId);
        if (profile) setCompanyProfile(profile);

        if (targetEditId) {
          setIsEditing(true);
          const existingBill = await getBillById(db, parseInt(targetEditId), companyId);
          if (existingBill) {
            const hData = typeof existingBill.header_data_json === 'string' ? JSON.parse(existingBill.header_data_json || '{}') : (existingBill.header_data_json || {});
            const rData = typeof existingBill.row_data_json === 'string' ? JSON.parse(existingBill.row_data_json || '[]') : (existingBill.row_data_json || []);
            setHeaderData(hData);
            setRowData(rData);
            if (hData.customer_phone || existingBill.customer_phone) setCustomerPhone(hData.customer_phone || existingBill.customer_phone);
            if (hData.customer_address || existingBill.customer_address) setCustomerAddress(hData.customer_address || existingBill.customer_address);
            setCalcSettings({
              includeTax: hData.calc_include_tax === 'true',
              taxRate: parseFloat(hData.calc_tax_rate || '18'),
              showTimeInTable: hData.calc_show_time_in_table === 'true',
            });
            // Load balance/paid entries from header
            if (hData.balance_entries) {
              try { setBalanceEntries(JSON.parse(hData.balance_entries)); } catch {}
            }
            if (hData.paid_entries) {
              try { setPaidEntries(JSON.parse(hData.paid_entries)); } catch {}
            }
            return;
          }
        }

        if (!targetEditId) {
          const draft = await getDraft(templateId, companyId);
          if (draft && draft.headerData && (Object.keys(draft.headerData).length > 0 || (draft.rowData && draft.rowData.length > 0))) {
            setSavedDraftData(draft);
            setDraftModalVisible(true);
          }
        }

        const nextBn = await getNextBillNumber(db, companyId);
        const compName = profile?.name || profile?.owner_name || profile?.company_name || user?.company_name || user?.name || '';
        const compLoc = profile?.location || profile?.address || user?.location || user?.address || '';
        const compPhone = profile?.phone || user?.phone || '';

        const hData = {};
        hFields.forEach(f => {
          const norm = normalizeKey(f.name);
          if (f.type === 'date' || f.type === 'datetime') hData[f.name] = new Date().toISOString();
          else if (norm === 'bn' || norm === 'billnumber' || norm === 'billno') hData[f.name] = nextBn;
          else if (norm === 'shopname' || norm === 'companyname' || norm === 'name') hData[f.name] = compName;
          else if (norm === 'shoplocation' || norm === 'shopaddress' || norm === 'address' || norm === 'location') hData[f.name] = compLoc;
          else if (norm === 'shopnumber' || norm === 'shopphone' || norm === 'phone' || norm === 'mobile') hData[f.name] = compPhone;
          else hData[f.name] = '';
        });

        const rowInit = {};
        tFields.forEach(f => {
          if (f.type === 'date' || f.type === 'datetime' || f.type === 'time') rowInit[f.name] = new Date().toISOString();
          else rowInit[f.name] = '';
        });
        const snoField = tFields.find(f => { const n = normalizeKey(f.name); return n === 'sno' || n === 'slno'; });
        if (snoField) rowInit[snoField.name] = '1';

        setRowData([{ ...rowInit }]);
        setHeaderData(hData);
      }
    } catch (error) { console.error('Error loading template:', error); }
  };

  // Auto-save draft
  useEffect(() => {
    if (!isEditing && template && headerData && Object.keys(headerData).length > 0) {
      saveDraft(templateId, {
        headerData,
        rowData,
        calcSettings,
        customerPhone,
        customerAddress,
        balanceEntries,
        paidEntries,
      }, companyId);
    }
  }, [headerData, rowData, calcSettings, customerPhone, customerAddress, balanceEntries, paidEntries, isEditing, template, companyId]);

  // Auto-sync Sno
  useEffect(() => {
    const snoField = tableFields.find(f => { const n = normalizeKey(f.name); return n === 'sno' || n === 'slno'; });
    if (snoField) {
      setRowData(prev => {
        let changed = false;
        const updated = prev.map((row, idx) => {
          const expected = String(idx + 1);
          if (row[snoField.name] !== expected) { changed = true; return { ...row, [snoField.name]: expected }; }
          return row;
        });
        return changed ? updated : prev;
      });
    }
  }, [rowData.length]);

  // ── Field Helpers ──
  const updateHeaderField = (fieldName, value) => setHeaderData(prev => ({ ...prev, [fieldName]: value }));

  const updateRowField = (rowIndex, fieldName, value) => {
    setRowData(prev => {
      const updated = [...prev];
      const row = { ...updated[rowIndex], [fieldName]: value };
      const normalizedFieldName = normalizeKey(fieldName);
      const isMaterialField = ['materialtype', 'materialstype', 'material', 'materials'].includes(normalizedFieldName);

      const costFieldName = Object.keys(row).find(k => {
        const norm = normalizeKey(k);
        return (norm === 'materialtypecost' || norm.includes('cost') || norm.includes('price') || norm.includes('rate'))
          && !norm.includes('eachvalue') && !norm.includes('total') && !norm.includes('amount') && !norm.includes('cal');
      }) || 'MaterialTypeCost';

      if (isMaterialField) {
        const material = materials.find(m => normalizeKey(m.name) === normalizeKey(value));
        if (material) row[costFieldName] = String(material.price_per_unit);
      }

      const calFieldName =
        Object.keys(row).find(k => {
          const norm = normalizeKey(k);
          return norm.includes('eachvalue') || (norm.startsWith('cal') && norm !== costFieldName)
            || (norm.includes('total') && !norm.includes('rate') && !norm.includes('cost'))
            || norm.includes('amount') || norm.includes('calculatedvalue');
        }) ||
        tableFields.find(f => {
          const norm = normalizeKey(f.name);
          return norm.includes('eachvalue') || norm.startsWith('cal') || norm.includes('total') || norm.includes('amount');
        })?.name;

      const isCalFieldEdited = calFieldName && normalizedFieldName === normalizeKey(calFieldName);
      if (!isCalFieldEdited && calFieldName) {
        let costVal = parseFloat(row[costFieldName] || '0');
        if (isNaN(costVal)) costVal = 0;
        const qtyVal = parseFloat(getRowValue(row, ['unit', 'units', 'qty', 'quantity']) || '0');
        // Calculation: Price × Units only (trip removed)
        let calculatedVal = 0;
        if (qtyVal > 0) calculatedVal = costVal * qtyVal;
        else calculatedVal = costVal;

        row[calFieldName] = calculatedVal > 0
          ? String(Number.isInteger(calculatedVal) ? calculatedVal : parseFloat(calculatedVal.toFixed(2)))
          : (costVal > 0 ? '0' : '');
      }

      updated[rowIndex] = row;
      return updated;
    });
  };

  const addRow = () => {
    const newRow = {};
    tableFields.forEach(f => {
      if (f.type === 'date' || f.type === 'datetime' || f.type === 'time') newRow[f.name] = new Date().toISOString();
      else newRow[f.name] = '';
    });
    const snoField = tableFields.find(f => { const n = normalizeKey(f.name); return n === 'sno' || n === 'slno'; });
    if (snoField) newRow[snoField.name] = String(rowData.length + 1);
    setRowData(prev => [...prev, newRow]);
  };

  const removeRow = (index) => {
    if (rowData.length <= 1) { Alert.alert('Cannot Remove', 'At least one item row is required.'); return; }
    setRowData(prev => prev.filter((_, i) => i !== index));
  };

  // ── Totals ──
  const getSubTotal = useCallback(() => {
    const calFieldName = tableFields.find(f => {
      const norm = normalizeKey(f.name);
      return norm.includes('eachvalue') || norm.startsWith('cal') || norm.includes('total') || norm.includes('amount') || norm.includes('calculatedvalue');
    })?.name;
    let sub = 0;
    if (calFieldName) {
      rowData.forEach(row => { const v = parseFloat(row[calFieldName]); if (!isNaN(v)) sub += v; });
    } else {
      const numericFields = tableFields.filter(f => f.type === 'numeric');
      const vf = numericFields.length > 0 ? numericFields[numericFields.length - 1] : null;
      if (vf) rowData.forEach(row => { const v = parseFloat(row[vf.name]); if (!isNaN(v)) sub += v; });
    }
    return sub;
  }, [rowData, tableFields]);

  const getTotalBalance = useCallback(() => {
    return balanceEntries.reduce((sum, e) => {
      const v = parseFloat(e.amount || '0'); return sum + (isNaN(v) ? 0 : v);
    }, 0);
  }, [balanceEntries]);

  const getTotalPaid = useCallback(() => {
    return paidEntries.reduce((sum, e) => {
      const v = parseFloat(e.amount || '0'); return sum + (isNaN(v) ? 0 : v);
    }, 0);
  }, [paidEntries]);

  const calculateTotal = useCallback(() => {
    const sub = getSubTotal();
    const balance = getTotalBalance();
    const paid = getTotalPaid();
    let taxAmount = 0;
    if (calcSettings.includeTax) {
      const rate = parseFloat(String(calcSettings.taxRate || '18'));
      if (!isNaN(rate) && rate > 0) taxAmount = sub * (rate / 100);
    }
    return sub + balance + taxAmount - paid;
  }, [getSubTotal, getTotalBalance, getTotalPaid, calcSettings]);

  // ── Material Picker ──
  const openMaterialPicker = (rowIndex, fieldName) => {
    setActiveRowIdx(rowIndex);
    setActiveFieldKey(fieldName);
    setShowCustomMaterialForm(false);
    setCustomMaterialInput('');
    setMaterialModalVisible(true);
  };

  const selectMaterial = (mat) => {
    const matObj = typeof mat === 'object' ? mat : materials.find(m => m.name.toLowerCase() === String(mat).toLowerCase());
    const matName = typeof mat === 'object' ? mat.name : mat;
    const matPrice = matObj ? String(matObj.price_per_unit || '') : '';
    setRowData(prev => {
      const updated = [...prev];
      if (activeRowIdx !== null && updated[activeRowIdx]) {
        const row = { ...updated[activeRowIdx], [activeFieldKey]: matName };
        if (matPrice) {
          const costField = tableFields.find(f => {
            const norm = normalizeKey(f.name);
            return norm === 'materialtypecost' || norm.includes('cost') || norm.includes('rate') || norm.includes('price');
          });
          if (costField) row[costField.name] = matPrice;
        }
        updated[activeRowIdx] = row;
      }
      return updated;
    });
    setMaterialModalVisible(false);
  };

  const handleSaveMaterialOnTheGo = async () => {
    if (!customMaterialInput.trim()) { Alert.alert('Required', 'Please enter material name.'); return; }
    setSavingCustomMaterial(true);
    try {
      const db = await getDatabase();
      const newMat = { name: customMaterialInput.trim(), price_per_unit: parseFloat(customPriceInput) || 0, unit_type: customUnitInput || 'unit', quarry_id: companyId };
      await saveMaterial(db, newMat);
      await loadMaterials();
      selectMaterial(newMat);
      setShowCustomMaterialForm(false);
      setCustomMaterialInput('');
      setCustomPriceInput('');
    } catch (e) {
      selectMaterial({ name: customMaterialInput.trim(), price_per_unit: parseFloat(customPriceInput) || 0 });
    } finally { setSavingCustomMaterial(false); }
  };

  // ── Customer Picker ──
  const openCustomerPicker = (fieldName) => {
    setActiveCustomerField(fieldName);
    setCustomerSearchQuery('');
    setShowAddCustomerForm(false);
    setCustomerModalVisible(true);
  };

  const selectCustomer = (c) => {
    if (activeCustomerField) updateHeaderField(activeCustomerField, c.name);
    setCustomerPhone(c.phone || '');
    setCustomerAddress(c.address || '');
    setCustomerModalVisible(false);
  };

  const handleCreateCustomerOnTheGo = async () => {
    const nameToSave = newCustName.trim() || customerSearchQuery.trim();
    if (!nameToSave) { Alert.alert('Required', 'Please enter customer / party name.'); return; }
    setSavingNewCustomer(true);
    try {
      const db = await getDatabase();
      const newCust = { name: nameToSave, phone: newCustPhone.trim(), address: newCustAddress.trim() };
      await saveCustomer(db, newCust, companyId);
      await loadCustomers();
      selectCustomer(newCust);
      setShowAddCustomerForm(false);
      setNewCustName(''); setNewCustPhone(''); setNewCustAddress('');
    } catch (e) { Alert.alert('Error', 'Failed to save customer.'); }
    finally { setSavingNewCustomer(false); }
  };

  // ── PDF / Save ──
  const buildMergedHeaderData = () => ({
    ...headerData,
    customer_phone: customerPhone,
    customer_address: customerAddress,
    calc_include_tax: calcSettings.includeTax ? 'true' : 'false',
    calc_tax_rate: String(calcSettings.taxRate),
    calc_show_time_in_table: calcSettings.showTimeInTable ? 'true' : 'false',
    balance_entries: JSON.stringify(balanceEntries),
    paid_entries: JSON.stringify(paidEntries),
    // Legacy single-value keys for PDF generator compatibility
    Balance: String(getTotalBalance()),
    Paid: String(getTotalPaid()),
  });

  const handleGenerateOnly = async () => {
    setGenerating(true);
    try {
      const totalAmount = calculateTotal();
      const result = await generatePDF({
        companyProfile,
        headerData: buildMergedHeaderData(),
        rowData,
        headerFields,
        tableFields,
        templateName: template?.name || 'Invoice',
        totalAmount,
        printWindow: null,
        themeColor: template?.theme_color,
        fontFamily: template?.font_family,
        borderStyle: template?.border_style,
      });
      if (!result.success) Alert.alert('Error', 'Failed to generate PDF: ' + (result.error || 'Unknown error'));
      else if (Platform.OS !== 'web') {
        const billNumber = headerData.BN || `BF-${Date.now().toString(36).toUpperCase()}`;
        const customerName = getRowValue(headerData, ['partyname', 'customername', 'clientname', 'name']) || '';
        const permanentUri = await savePDFPermanently(result.uri, billNumber, customerName);
        await sharePDF(permanentUri);
      }
    } catch (error) {
      console.error('PDF generation error:', error);
      Alert.alert('Error', 'Failed to generate PDF.');
    } finally { setGenerating(false); }
  };

  const handleSaveBill = async () => {
    setSaving(true);
    try {
      const db = await getDatabase();
      const totalAmount = calculateTotal();
      const billNumber = headerData.BN || `BF-${Date.now().toString(36).toUpperCase()}`;
      const customerName = getRowValue(headerData, ['partyname', 'customername', 'clientname', 'name']) || '';
      const headerDataToSave = buildMergedHeaderData();

      if (customerName && customerName.trim() !== '') {
        const existing = customers.find(c => normalizeKey(c.name) === normalizeKey(customerName));
        const customerData = { name: customerName, phone: customerPhone || '', address: customerAddress || '', quarry_id: companyId || 1 };
        if (existing) { if (existing.phone !== customerPhone || existing.address !== customerAddress) await saveCustomer(db, { ...existing, ...customerData }); }
        else await saveCustomer(db, customerData);
        await loadCustomers();
      }

      const pdfResult = await generatePDF({
        companyProfile, headerData: headerDataToSave, rowData, headerFields, tableFields,
        templateName: template?.name || 'Invoice', totalAmount, printWindow: null,
        themeColor: template?.theme_color, fontFamily: template?.font_family, borderStyle: template?.border_style,
      });

      let pdfUri = '';
      if (pdfResult.success && Platform.OS !== 'web') pdfUri = await savePDFPermanently(pdfResult.uri, billNumber, customerName);

      const billId = await saveBill(db, {
        template_id: parseInt(templateId), company_id: companyId || 1, bill_number: billNumber,
        customer_name: customerName, headerData: headerDataToSave, rowData, total_amount: totalAmount, pdf_uri: pdfUri,
      });

      await clearDraft(templateId, companyId);
      showToast(`Bill "${billNumber}" saved successfully! 📄`, 'success', 'Bill Saved');

      Alert.alert('Bill Saved ✅', `Bill "${billNumber}" saved successfully.`, [
        { text: 'View Bill', onPress: () => router.replace(`/bill-preview/${billId}`) },
        { text: 'New Bill', onPress: () => router.replace(`/bill-form/${templateId}`) },
      ]);
    } catch (error) {
      console.error('Save bill error:', error);
      Alert.alert('Error', 'Failed to save bill.');
    } finally { setSaving(false); }
  };

  const handleSaveAndShareWhatsAppPress = () => {
    setWhatsappPhone(customerPhone || '');
    setWhatsappModalVisible(true);
  };

  const confirmSaveAndShareWhatsApp = async () => {
    setWhatsappModalVisible(false);
    setSaving(true);
    setSharingWhatsApp(true);
    let formattedPhone = whatsappPhone.trim().replace(/[\s+-]/g, '');
    if (formattedPhone.length === 10) formattedPhone = `91${formattedPhone}`;
    let waWindow = null;
    if (Platform.OS === 'web' && formattedPhone) waWindow = window.open('', '_blank');

    try {
      const db = await getDatabase();
      const totalAmount = calculateTotal();
      const billNumber = headerData.BN || `BF-${Date.now().toString(36).toUpperCase()}`;
      const customerName = getRowValue(headerData, ['partyname', 'customername', 'clientname', 'name']) || '';
      const headerDataToSave = buildMergedHeaderData();

      if (customerName && customerName.trim() !== '') {
        const existing = customers.find(c => normalizeKey(c.name) === normalizeKey(customerName));
        const customerData = { name: customerName, phone: whatsappPhone || '', address: customerAddress || '', quarry_id: companyId || 1 };
        if (existing) { if (existing.phone !== whatsappPhone || existing.address !== customerAddress) await saveCustomer(db, { ...existing, ...customerData }); }
        else await saveCustomer(db, customerData);
        await loadCustomers();
      }

      const pdfResult = await generatePDF({
        companyProfile, headerData: headerDataToSave, rowData, headerFields, tableFields,
        templateName: template?.name || 'Invoice', totalAmount, printWindow: null,
        themeColor: template?.theme_color, fontFamily: template?.font_family, borderStyle: template?.border_style,
      });

      let pdfUri = '';
      if (pdfResult.success && Platform.OS !== 'web') pdfUri = await savePDFPermanently(pdfResult.uri, billNumber, customerName);

      const savedId = await saveBill(db, {
        id: editBillId ? parseInt(editBillId) : undefined,
        template_id: parseInt(templateId), company_id: companyId || 1, bill_number: billNumber,
        customer_name: customerName, headerData: headerDataToSave, rowData, total_amount: totalAmount, pdf_uri: pdfUri,
      });

      await clearDraft(templateId, companyId);

      const shopNameStr = getRowValue(headerData, ['shopname', 'companyname']) || companyProfile?.name || '';
      const messageText = `Dear Customer, here is your invoice (No: ${billNumber}) from ${shopNameStr}. Total Amount: Rs. ${formatIndianNumber(totalAmount)}. Thank you for your business!`;
      const encodedMsg = encodeURIComponent(messageText);

      if (Platform.OS !== 'web' && pdfUri) {
        await sharePDF(pdfUri);
        if (formattedPhone) {
          const waUrl = `whatsapp://send?phone=${formattedPhone}&text=${encodedMsg}`;
          try {
            const { Linking } = require('react-native');
            const supported = await Linking.canOpenURL(waUrl);
            if (supported) setTimeout(() => Linking.openURL(waUrl), 1200);
          } catch (e) {}
        }
      } else if (Platform.OS === 'web') {
        const webWaUrl = `https://wa.me/${formattedPhone || ''}?text=${encodedMsg}`;
        if (waWindow && !waWindow.closed) waWindow.location.href = webWaUrl;
        else window.open(webWaUrl, '_blank');
      }

      Alert.alert('Bill Saved & Sent! ✅', `Bill "${billNumber}" saved.`, [
        { text: 'View Invoice', onPress: () => router.replace(`/bill-preview/${savedId}`) },
        { text: 'History', onPress: () => router.replace('/(tabs)/history') },
      ]);
    } catch (error) {
      console.error('Save & Share WhatsApp Error:', error);
      Alert.alert('Error', 'Failed to save and share bill.');
    } finally { setSaving(false); setSharingWhatsApp(false); }
  };

  const handleMinimizeBill = async () => {
    try {
      await minimizeDraft(templateId, { headerData, rowData, calcSettings, customerPhone, customerAddress, balanceEntries, paidEntries }, companyId);
      Alert.alert('Bill Minimized 📄', 'Your draft is saved. Resume anytime from Leftover Bills!', [{ text: 'OK', onPress: () => router.push('/(tabs)') }]);
    } catch (e) { router.push('/(tabs)'); }
  };

  // ── Step Navigation ──
  const goNext = () => { if (currentStep < STEPS.length - 1) setCurrentStep(s => s + 1); };
  const goPrev = () => { if (currentStep > 0) setCurrentStep(s => s - 1); };

  // ── Derived company info ──
  const companyName = getRowValue(headerData, ['shopname', 'companyname', 'name']) || companyProfile?.name || companyProfile?.owner_name || user?.company_name || user?.name || '';
  const companyAddress = getRowValue(headerData, ['shoplocation', 'shopaddress', 'address', 'location']) || companyProfile?.location || companyProfile?.address || user?.location || user?.address || '';
  const companyPhone = getRowValue(headerData, ['shopnumber', 'shopphone', 'phone', 'mobile']) || companyProfile?.phone || user?.phone || '';
  const partyName = getRowValue(headerData, ['partyname', 'customername', 'clientname', 'name']) || '';
  const billNumber = getRowValue(headerData, ['bn', 'billnumber']) || '';

  // ── Inline HTML Preview Builder ──
  const buildPreviewHTML = () => {
    const themeColor = template?.theme_color || '#1a237e';
    const sub = getSubTotal();
    const bal = getTotalBalance();
    const paid = getTotalPaid();
    let tax = 0;
    if (calcSettings.includeTax) {
      const rate = parseFloat(String(calcSettings.taxRate || 0));
      if (!isNaN(rate) && rate > 0) tax = sub * (rate / 100);
    }
    const grand = sub + bal + tax - paid;

    const calFieldName = tableFields.find(f => {
      const n = normalizeKey(f.name);
      return n.includes('eachvalue') || n.startsWith('cal') || n.includes('total') || n.includes('amount') || n.includes('calculatedvalue');
    })?.name;

    const displayTableFields = tableFields.filter(f => {
      const n = normalizeKey(f.name);
      return !(n === 'materialtypecost' || n.includes('priceperunit') || n.includes('priceper') ||
        (n.includes('cost') && !n.includes('total')) ||
        (n.includes('rate') && !n.includes('total')) ||
        n.includes('perunit') || n.includes('unitprice') || n.includes('unitrate'));
    });

    const rawDate = getRowValue(headerData, ['billdate', 'date']);
    const billDate = rawDate ? formatDate(rawDate) : new Date().toLocaleDateString('en-IN');
    const deliveryLoc = getRowValue(headerData, ['deliveryloc', 'place', 'location', 'deliverylocation']) || '';

    const rowsHTML = rowData.map((row, i) => {
      const cells = displayTableFields.map(f => {
        let val = row[f.name] || '';
        if ((f.type === 'date' || f.type === 'datetime') && val) val = formatDate(val);
        const isNum = f.type === 'numeric' || normalizeKey(f.name).startsWith('cal') || normalizeKey(f.name).includes('amount');
        if (isNum && val) { const n = parseFloat(val); if (!isNaN(n)) val = '₹' + formatIndianNumber(n); }
        return `<td style="border:1px solid ${themeColor};padding:5px 8px;text-align:${isNum ? 'right' : 'left'}">${val}</td>`;
      }).join('');
      return `<tr style="background:${i % 2 === 0 ? '#fff' : '#f8f9ff'}">${cells}</tr>`;
    });

    const headerCols = displayTableFields.map(f =>
      `<th style="border:1px solid ${themeColor};padding:6px 8px;background:${themeColor};color:#fff;text-align:left;font-size:12px">${f.label || f.name}</th>`
    ).join('');

    return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Segoe UI',Arial,sans-serif;font-size:13px;color:#111;background:#f5f5f5;padding:10px}
.sheet{background:#fff;padding:24px;max-width:800px;margin:0 auto;border:1px solid ${themeColor};border-radius:4px}
.shop-name{font-size:22px;font-weight:900;text-align:center;color:${themeColor};text-transform:uppercase;letter-spacing:1px}
.shop-sub{font-size:12px;text-align:center;color:#444;margin-top:4px}
.divider{height:2px;background:${themeColor};margin:10px 0}
.info-grid{display:flex;justify-content:space-between;margin-bottom:16px;gap:12px}
.info-left{flex:2}.info-right{flex:1;text-align:right}
.info-label{font-size:11px;font-weight:bold;color:#888;margin-bottom:2px}
.info-val{font-size:13px;font-weight:bold;color:#111}
table{width:100%;border-collapse:collapse;margin-bottom:12px}
.totals-table{max-width:260px;margin-left:auto;margin-bottom:20px;border:1px solid ${themeColor}}
.totals-table td{padding:6px 10px;font-size:13px;font-weight:bold}
.totals-table .grand{background:${themeColor};color:#fff;font-size:15px}
.sig{margin-top:32px;display:flex;align-items:flex-end;gap:10px}
.sig-line{flex:1;border-bottom:1px solid #333;margin-left:8px}
</style></head><body><div class="sheet">
<div class="shop-name">${companyName || 'COMPANY NAME'}</div>
<div class="shop-sub">${companyAddress}${companyPhone ? ' | 📞 ' + companyPhone : ''}</div>
<div class="divider"></div>
<div class="info-grid">
  <div class="info-left">
    <div class="info-label">Bill To (M/s)</div>
    <div class="info-val">${partyName || '—'}</div>
    ${customerPhone ? `<div style="font-size:11px;color:#666;margin-top:2px">📞 ${customerPhone}</div>` : ''}
    ${customerAddress ? `<div style="font-size:11px;color:#666">📍 ${customerAddress}</div>` : ''}
  </div>
  <div class="info-right">
    <div class="info-label">Bill No.</div><div class="info-val">${billNumber || '—'}</div>
    <div class="info-label" style="margin-top:6px">Date</div><div class="info-val">${billDate}</div>
    ${deliveryLoc ? `<div class="info-label" style="margin-top:6px">Delivery</div><div class="info-val">${deliveryLoc}</div>` : ''}
  </div>
</div>
<table><thead><tr>${headerCols}</tr></thead><tbody>${rowsHTML.join('')}</tbody></table>
<table class="totals-table">
  ${(calcSettings.includeTax || bal > 0 || paid > 0) ? `<tr><td>Subtotal</td><td style="text-align:right">₹${formatIndianNumber(sub)}</td></tr>` : ''}
  ${calcSettings.includeTax ? `<tr><td>GST (${calcSettings.taxRate}%)</td><td style="text-align:right">₹${formatIndianNumber(tax)}</td></tr>` : ''}
  ${bal > 0 ? `<tr><td>Uncleared Balance</td><td style="text-align:right">₹${formatIndianNumber(bal)}</td></tr>` : ''}
  ${paid > 0 ? `<tr><td>Paid</td><td style="text-align:right">- ₹${formatIndianNumber(paid)}</td></tr>` : ''}
  <tr class="grand"><td>TOTAL</td><td style="text-align:right">₹${formatIndianNumber(grand)}</td></tr>
</table>
<div class="sig"><span style="font-weight:bold;font-size:12px">Receiver's Signature:</span><div class="sig-line"></div></div>
</div></body></html>`;
  };

  // ── Step Renderers ──────────────────────────────────────────────────────────

  const renderStep0 = () => {
    const partyNameField = headerFields.find(f => ['partyname', 'customername', 'clientname', 'name'].includes(normalizeKey(f.name)));
    const billNumberField = headerFields.find(f => { const n = normalizeKey(f.name); return n === 'bn' || n === 'billnumber' || n === 'billno'; });
    return (
      <View>
        <StepCard icon="document-text-outline" iconBg="#EEF2FF" iconColor="#6366F1" title="Bill Details" subtitle="Basic bill information and customer">
          {/* Bill Number */}
          {billNumberField && (
            <View style={styles.fieldBlock}>
              <Text style={styles.fieldLabel}>Bill Number</Text>
              <View style={styles.billNoRow}>
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  value={headerData[billNumberField.name] || ''}
                  onChangeText={v => updateHeaderField(billNumberField.name, v)}
                  placeholder="Auto-generated"
                  placeholderTextColor={Colors.textTertiary}
                />
                <View style={styles.autoTag}>
                  <Ionicons name="flash" size={12} color={Colors.primary} />
                  <Text style={styles.autoTagText}>Auto</Text>
                </View>
              </View>
            </View>
          )}

          {/* Party Name */}
          {partyNameField ? (
            <View style={styles.fieldBlock}>
              <View style={styles.labelRow}>
                <Text style={styles.fieldLabel}>{partyNameField.label || 'Customer / Party Name'}</Text>
                <TouchableOpacity style={styles.pillBtn} onPress={() => openCustomerPicker(partyNameField.name)}>
                  <Ionicons name="people-outline" size={13} color={Colors.primary} />
                  <Text style={styles.pillBtnText}>Select Existing</Text>
                </TouchableOpacity>
              </View>
              <TextInput
                style={styles.input}
                value={headerData[partyNameField.name] || ''}
                onChangeText={v => {
                  updateHeaderField(partyNameField.name, v);
                  const ex = customers.find(c => normalizeKey(c.name) === normalizeKey(v));
                  if (ex) { setCustomerPhone(ex.phone || ''); setCustomerAddress(ex.address || ''); }
                }}
                placeholder="Enter customer or party name"
                placeholderTextColor={Colors.textTertiary}
              />
            </View>
          ) : (
            <View style={styles.fieldBlock}>
              <View style={styles.labelRow}>
                <Text style={styles.fieldLabel}>Customer / Party Name</Text>
              </View>
              <TextInput
                style={styles.input}
                value={headerData['PartyName'] || ''}
                onChangeText={v => updateHeaderField('PartyName', v)}
                placeholder="Enter customer or party name"
                placeholderTextColor={Colors.textTertiary}
              />
            </View>
          )}

          {/* Customer Phone */}
          <View style={styles.fieldBlock}>
            <Text style={styles.fieldLabel}>Customer Phone <Text style={styles.optionalTag}>(Optional)</Text></Text>
            <TextInput
              style={styles.input}
              value={customerPhone}
              onChangeText={setCustomerPhone}
              placeholder="10-digit mobile number"
              placeholderTextColor={Colors.textTertiary}
              keyboardType="phone-pad"
            />
          </View>

          {/* Customer Address */}
          <View style={styles.fieldBlock}>
            <Text style={styles.fieldLabel}>Resident / Site Address <Text style={styles.optionalTag}>(Optional)</Text></Text>
            <TextInput
              style={[styles.input, { minHeight: 70, textAlignVertical: 'top', paddingTop: 10 }]}
              value={customerAddress}
              onChangeText={setCustomerAddress}
              placeholder="Customer's delivery or residential address"
              placeholderTextColor={Colors.textTertiary}
              multiline
            />
          </View>
        </StepCard>
      </View>
    );
  };

  const renderStep1 = () => {
    const dateField = headerFields.find(f => f.type === 'date' || f.type === 'datetime' || normalizeKey(f.name).includes('date') || normalizeKey(f.name) === 'billdate');
    const deliveryField = headerFields.find(f => {
      const n = normalizeKey(f.name);
      return n.includes('deliveryloc') || n.includes('place') || n === 'deliverylocation';
    });

    return (
      <View>
        <StepCard icon="calendar-outline" iconBg="#F5F3FF" iconColor="#8B5CF6" title="Bill Date & Delivery" subtitle="Set the billing date and delivery location">
          {dateField ? (
            <View style={styles.fieldBlock}>
              <Text style={styles.fieldLabel}>{dateField.label || 'Bill Date'}</Text>
              <DateTimePickerInput
                value={headerData[dateField.name] ? new Date(headerData[dateField.name]) : new Date()}
                onChange={d => updateHeaderField(dateField.name, d.toISOString())}
                mode={dateField.type === 'datetime' ? 'datetime' : 'date'}
              />
            </View>
          ) : (
            <View style={styles.fieldBlock}>
              <Text style={styles.fieldLabel}>Bill Date</Text>
              <DateTimePickerInput
                value={new Date()}
                onChange={d => updateHeaderField('BillDate', d.toISOString())}
                mode="date"
              />
            </View>
          )}

          {deliveryField ? (
            <View style={styles.fieldBlock}>
              <Text style={styles.fieldLabel}>{deliveryField.label || 'Delivery Location'}</Text>
              <TextInput
                style={styles.input}
                value={headerData[deliveryField.name] || ''}
                onChangeText={v => updateHeaderField(deliveryField.name, v)}
                placeholder="Enter delivery / place name"
                placeholderTextColor={Colors.textTertiary}
              />
            </View>
          ) : (
            <View style={styles.fieldBlock}>
              <Text style={styles.fieldLabel}>Delivery Location</Text>
              <TextInput
                style={styles.input}
                value={headerData['DeliveryLoc'] || ''}
                onChangeText={v => updateHeaderField('DeliveryLoc', v)}
                placeholder="Enter delivery / place name"
                placeholderTextColor={Colors.textTertiary}
              />
            </View>
          )}

          {/* Other header fields (not BN, name, date, delivery) */}
          {headerFields.filter(f => {
            const n = normalizeKey(f.name);
            return !['bn', 'billnumber', 'billno', 'partyname', 'customername', 'clientname', 'name',
              'shopname', 'companyname', 'shoplocation', 'shopaddress', 'address', 'location', 'shopnumber', 'shopphone', 'phone', 'mobile',
              'billdate', 'date', 'deliveryloc', 'place', 'deliverylocation', 'total', 'balance', 'balanceamount', 'paid', 'paidamount',
            ].includes(n) && f.type !== 'date' && f.type !== 'datetime';
          }).map(f => (
            <View key={f.name} style={styles.fieldBlock}>
              <Text style={styles.fieldLabel}>{f.label || f.name}</Text>
              <TextInput
                style={styles.input}
                value={headerData[f.name] || ''}
                onChangeText={v => updateHeaderField(f.name, v)}
                placeholder={`Enter ${(f.label || f.name).toLowerCase()}`}
                placeholderTextColor={Colors.textTertiary}
                keyboardType={getKeyboardTypeForField(f.type)}
              />
            </View>
          ))}
        </StepCard>
      </View>
    );
  };

  const renderStep2 = () => (
    <View>
      <StepCard icon="cube-outline" iconBg="#FFFBEB" iconColor="#F59E0B" title="Line Items" subtitle={`${rowData.length} material${rowData.length !== 1 ? 's' : ''} added • Price × Units = Amount`}>
        {rowData.map((row, rowIndex) => {
          const itemMaterialName = getRowValue(row, ['materialtype', 'materialstype', 'material', 'materials']) || '';
          const calFieldName = tableFields.find(f => {
            const n = normalizeKey(f.name);
            return n.includes('eachvalue') || n.startsWith('cal') || n.includes('total') || n.includes('amount') || n.includes('calculatedvalue');
          })?.name;
          const rowTotal = calFieldName ? parseFloat(row[calFieldName] || '0') : 0;

          return (
            <View key={rowIndex} style={styles.materialCard}>
              {/* Row Header */}
              <View style={styles.materialCardHeader}>
                <View style={styles.materialCardBadge}>
                  <Text style={styles.materialCardBadgeText}>#{rowIndex + 1}</Text>
                </View>
                <Text style={styles.materialCardTitle} numberOfLines={1}>
                  {itemMaterialName || `Item ${rowIndex + 1}`}
                </Text>
                <View style={styles.materialCardHeaderRight}>
                  {rowTotal > 0 && (
                    <View style={styles.rowAmountBadge}>
                      <Text style={styles.rowAmountText}>₹{formatIndianNumber(rowTotal)}</Text>
                    </View>
                  )}
                  {rowData.length > 1 && (
                    <TouchableOpacity onPress={() => removeRow(rowIndex)} style={styles.removeBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                      <Ionicons name="trash-outline" size={18} color={Colors.danger} />
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              {/* Quick material chips */}
              {materials.length > 0 && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll} contentContainerStyle={{ gap: 6, paddingVertical: 2 }}>
                  {materials.slice(0, 6).map(m => (
                    <TouchableOpacity
                      key={m.id}
                      style={[styles.chip, itemMaterialName === m.name && styles.chipActive]}
                      onPress={() => {
                        const matField = tableFields.find(f => ['materialtype', 'materialstype', 'material', 'materials'].includes(normalizeKey(f.name)));
                        if (matField) { setActiveRowIdx(rowIndex); setActiveFieldKey(matField.name); selectMaterial(m); }
                      }}
                    >
                      <Text style={[styles.chipText, itemMaterialName === m.name && styles.chipTextActive]}>{m.name}</Text>
                    </TouchableOpacity>
                  ))}
                  <TouchableOpacity
                    style={styles.chip}
                    onPress={() => {
                      const matField = tableFields.find(f => ['materialtype', 'materialstype', 'material', 'materials'].includes(normalizeKey(f.name)));
                      if (matField) openMaterialPicker(rowIndex, matField.name);
                    }}
                  >
                    <Ionicons name="add" size={12} color={Colors.primary} />
                    <Text style={[styles.chipText, { color: Colors.primary }]}>More</Text>
                  </TouchableOpacity>
                </ScrollView>
              )}

              {/* Fields grid */}
              <View style={styles.fieldsGrid}>
                {tableFields.map(field => {
                  const normName = normalizeKey(field.name);
                  const isMaterialTypeField = ['materialtype', 'materialstype', 'material', 'materials'].includes(normName);
                  const isCalc = normName.includes('eachvalue') || (normName.startsWith('cal') && !normName.includes('materialtypecost')) || normName.includes('calculatedvalue');
                  const isCost = normName === 'materialtypecost' || (normName.includes('cost') && !normName.includes('total')) || normName.includes('priceperunit') || normName.includes('priceper');
                  const isQty = normName.includes('unit') || normName === 'qty' || normName === 'quantity';
                  const isFullWidth = isMaterialTypeField || isCalc || (normName.includes('desc'));

                  return (
                    <View key={field.name} style={[styles.fieldGridItem, isFullWidth ? styles.fieldFullWidth : styles.fieldHalfWidth]}>
                      <Text style={styles.fieldLabel}>
                        {field.label || field.name}
                        {isCost ? ' (₹)' : ''}
                        {isCalc ? <Text style={{ color: Colors.success }}> = Auto</Text> : ''}
                      </Text>
                      {isMaterialTypeField ? (
                        <TouchableOpacity style={styles.dropdownBtn} onPress={() => openMaterialPicker(rowIndex, field.name)}>
                          <Ionicons name="cube-outline" size={15} color={Colors.primary} />
                          <Text style={[styles.dropdownBtnText, !row[field.name] && styles.placeholderText]} numberOfLines={1}>
                            {row[field.name] || 'Select or type material...'}
                          </Text>
                          <Ionicons name="chevron-down" size={14} color={Colors.textTertiary} />
                        </TouchableOpacity>
                      ) : (field.type === 'date' || field.type === 'datetime' || field.type === 'time') ? (
                        <DateTimePickerInput
                          value={row[field.name] ? new Date(row[field.name]) : null}
                          onChange={d => updateRowField(rowIndex, field.name, d.toISOString())}
                          mode={field.type}
                        />
                      ) : (
                        <TextInput
                          style={[styles.input, isCalc && styles.inputCalc]}
                          value={row[field.name] !== undefined ? String(row[field.name]) : ''}
                          onChangeText={v => updateRowField(rowIndex, field.name, v)}
                          placeholder={isCost ? '0.00' : isQty ? '0' : field.label}
                          placeholderTextColor={Colors.textTertiary}
                          keyboardType={getKeyboardTypeForField(field.type)}
                          editable={!isCalc}
                        />
                      )}
                    </View>
                  );
                })}
              </View>
            </View>
          );
        })}

        <TouchableOpacity style={styles.addItemBtn} onPress={addRow}>
          <View style={styles.addItemBtnInner}>
            <Ionicons name="add-circle" size={20} color={Colors.accent} />
            <Text style={styles.addItemBtnText}>Add Another Material</Text>
          </View>
        </TouchableOpacity>

        {/* Running subtotal */}
        {getSubTotal() > 0 && (
          <View style={styles.runningTotal}>
            <Text style={styles.runningTotalLabel}>Materials Subtotal</Text>
            <Text style={styles.runningTotalValue}>₹{formatIndianNumber(getSubTotal())}</Text>
          </View>
        )}
      </StepCard>
    </View>
  );

  const renderStep3 = () => (
    <View>
      {/* Uncleared Balances */}
      <StepCard icon="alert-circle-outline" iconBg="#FEF3C7" iconColor="#D97706" title="Previous Balances" subtitle="Any uncleared amounts from previous bills">
        {balanceEntries.map((entry, idx) => (
          <View key={idx} style={styles.paymentEntryCard}>
            <View style={styles.paymentEntryHeader}>
              <View style={styles.entryBadge}>
                <Text style={styles.entryBadgeText}>Balance #{idx + 1}</Text>
              </View>
              {balanceEntries.length > 1 && (
                <TouchableOpacity onPress={() => setBalanceEntries(prev => prev.filter((_, i) => i !== idx))}>
                  <Ionicons name="close-circle" size={20} color={Colors.danger} />
                </TouchableOpacity>
              )}
            </View>
            <View style={styles.paymentRowFields}>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>Amount (₹)</Text>
                <TextInput
                  style={styles.input}
                  value={entry.amount}
                  onChangeText={v => setBalanceEntries(prev => prev.map((e, i) => i === idx ? { ...e, amount: v } : e))}
                  placeholder="0.00"
                  placeholderTextColor={Colors.textTertiary}
                  keyboardType="decimal-pad"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>As of Date</Text>
                <DateTimePickerInput
                  value={entry.date ? new Date(entry.date) : new Date()}
                  onChange={d => setBalanceEntries(prev => prev.map((e, i) => i === idx ? { ...e, date: d.toISOString() } : e))}
                  mode="date"
                />
              </View>
            </View>
            <View style={styles.fieldBlock}>
              <Text style={styles.fieldLabel}>Note <Text style={styles.optionalTag}>(Optional)</Text></Text>
              <TextInput
                style={styles.input}
                value={entry.note}
                onChangeText={v => setBalanceEntries(prev => prev.map((e, i) => i === idx ? { ...e, note: v } : e))}
                placeholder="e.g. Previous month pending"
                placeholderTextColor={Colors.textTertiary}
              />
            </View>
          </View>
        ))}
        <TouchableOpacity style={styles.addEntryBtn} onPress={() => setBalanceEntries(prev => [...prev, { amount: '', date: new Date().toISOString(), note: '' }])}>
          <Ionicons name="add-circle-outline" size={17} color="#D97706" />
          <Text style={[styles.addItemBtnText, { color: '#D97706' }]}>Add Another Balance Entry</Text>
        </TouchableOpacity>
        {getTotalBalance() > 0 && (
          <View style={[styles.runningTotal, { backgroundColor: '#FEF3C7' }]}>
            <Text style={[styles.runningTotalLabel, { color: '#92400E' }]}>Total Balance</Text>
            <Text style={[styles.runningTotalValue, { color: '#92400E' }]}>₹{formatIndianNumber(getTotalBalance())}</Text>
          </View>
        )}
      </StepCard>

      {/* Paid Amounts */}
      <StepCard icon="checkmark-circle-outline" iconBg="#ECFDF5" iconColor="#059669" title="Payments Received" subtitle="Amounts already paid by the customer">
        {paidEntries.map((entry, idx) => (
          <View key={idx} style={styles.paymentEntryCard}>
            <View style={styles.paymentEntryHeader}>
              <View style={[styles.entryBadge, { backgroundColor: '#D1FAE5' }]}>
                <Text style={[styles.entryBadgeText, { color: '#065F46' }]}>Payment #{idx + 1}</Text>
              </View>
              {paidEntries.length > 1 && (
                <TouchableOpacity onPress={() => setPaidEntries(prev => prev.filter((_, i) => i !== idx))}>
                  <Ionicons name="close-circle" size={20} color={Colors.danger} />
                </TouchableOpacity>
              )}
            </View>
            <View style={styles.paymentRowFields}>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>Paid Amount (₹)</Text>
                <TextInput
                  style={styles.input}
                  value={entry.amount}
                  onChangeText={v => setPaidEntries(prev => prev.map((e, i) => i === idx ? { ...e, amount: v } : e))}
                  placeholder="0.00"
                  placeholderTextColor={Colors.textTertiary}
                  keyboardType="decimal-pad"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>Paid Date</Text>
                <DateTimePickerInput
                  value={entry.date ? new Date(entry.date) : new Date()}
                  onChange={d => setPaidEntries(prev => prev.map((e, i) => i === idx ? { ...e, date: d.toISOString() } : e))}
                  mode="date"
                />
              </View>
            </View>
            <View style={styles.fieldBlock}>
              <Text style={styles.fieldLabel}>Note <Text style={styles.optionalTag}>(Optional)</Text></Text>
              <TextInput
                style={styles.input}
                value={entry.note}
                onChangeText={v => setPaidEntries(prev => prev.map((e, i) => i === idx ? { ...e, note: v } : e))}
                placeholder="e.g. UPI, Cash, Cheque"
                placeholderTextColor={Colors.textTertiary}
              />
            </View>
          </View>
        ))}
        <TouchableOpacity style={styles.addEntryBtn} onPress={() => setPaidEntries(prev => [...prev, { amount: '', date: new Date().toISOString(), note: '' }])}>
          <Ionicons name="add-circle-outline" size={17} color="#059669" />
          <Text style={[styles.addItemBtnText, { color: '#059669' }]}>Add Another Payment Entry</Text>
        </TouchableOpacity>
        {getTotalPaid() > 0 && (
          <View style={[styles.runningTotal, { backgroundColor: '#ECFDF5' }]}>
            <Text style={[styles.runningTotalLabel, { color: '#065F46' }]}>Total Paid</Text>
            <Text style={[styles.runningTotalValue, { color: '#065F46' }]}>₹{formatIndianNumber(getTotalPaid())}</Text>
          </View>
        )}
      </StepCard>
    </View>
  );

  const renderStep4 = () => (
    <View>
      <StepCard icon="settings-outline" iconBg="#EFF6FF" iconColor="#3B82F6" title="Calculation Settings" subtitle="GST, taxes and display preferences">

        {/* Formula explanation */}
        <View style={styles.formulaBox}>
          <Ionicons name="calculator-outline" size={18} color="#3B82F6" />
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={styles.formulaTitle}>Amount Calculation</Text>
            <Text style={styles.formulaText}>Price per Unit × Number of Units = Row Amount</Text>
            <Text style={styles.formulaText}>Sum of all Row Amounts = Materials Subtotal</Text>
          </View>
        </View>

        <View style={styles.settingRow}>
          <View style={styles.settingTextContainer}>
            <Text style={styles.settingLabel}>Apply GST / Taxes</Text>
            <Text style={styles.settingDesc}>Include GST tax to the subtotal of the invoice</Text>
          </View>
          <Switch
            value={calcSettings.includeTax}
            onValueChange={v => setCalcSettings(prev => ({ ...prev, includeTax: v }))}
            trackColor={{ false: Colors.border, true: Colors.primary }}
            thumbColor={calcSettings.includeTax ? '#fff' : '#f4f3f4'}
          />
        </View>

        {calcSettings.includeTax && (
          <View style={[styles.fieldBlock, { marginLeft: 10 }]}>
            <Text style={styles.fieldLabel}>GST / Tax Rate (%)</Text>
            <View style={styles.gstInputRow}>
              {[5, 12, 18, 28].map(rate => (
                <TouchableOpacity
                  key={rate}
                  style={[styles.gstRateChip, calcSettings.taxRate === rate && styles.gstRateChipActive]}
                  onPress={() => setCalcSettings(prev => ({ ...prev, taxRate: rate }))}
                >
                  <Text style={[styles.gstRateText, calcSettings.taxRate === rate && styles.gstRateTextActive]}>{rate}%</Text>
                </TouchableOpacity>
              ))}
              <TextInput
                style={[styles.input, { flex: 1, minWidth: 70 }]}
                value={String(calcSettings.taxRate)}
                onChangeText={v => { const p = parseFloat(v); setCalcSettings(prev => ({ ...prev, taxRate: isNaN(p) ? 0 : p })); }}
                placeholder="Custom"
                placeholderTextColor={Colors.textTertiary}
                keyboardType="decimal-pad"
              />
            </View>
          </View>
        )}

        <View style={styles.settingDivider} />

        <View style={styles.settingRow}>
          <View style={styles.settingTextContainer}>
            <Text style={styles.settingLabel}>Show Time in Date Columns</Text>
            <Text style={styles.settingDesc}>Display both date and time inside table date cells</Text>
          </View>
          <Switch
            value={calcSettings.showTimeInTable}
            onValueChange={v => setCalcSettings(prev => ({ ...prev, showTimeInTable: v }))}
            trackColor={{ false: Colors.border, true: Colors.primary }}
            thumbColor={calcSettings.showTimeInTable ? '#fff' : '#f4f3f4'}
          />
        </View>
      </StepCard>
    </View>
  );

  const renderStep5 = () => {
    const sub = getSubTotal();
    const bal = getTotalBalance();
    const paid = getTotalPaid();
    const taxRate = parseFloat(String(calcSettings.taxRate || 0));
    const tax = calcSettings.includeTax && !isNaN(taxRate) && taxRate > 0 ? sub * (taxRate / 100) : 0;
    const grand = sub + bal + tax - paid;

    return (
      <View>
        <StepCard icon="calculator-outline" iconBg="#FDF4FF" iconColor="#EC4899" title="Bill Summary" subtitle="Complete breakdown of your invoice">

          {/* Materials breakdown */}
          <View style={styles.summarySection}>
            <Text style={styles.summarySectionTitle}>📦 Materials ({rowData.length})</Text>
            {rowData.map((row, i) => {
              const matName = getRowValue(row, ['materialtype', 'materialstype', 'material', 'materials']) || `Item ${i + 1}`;
              const calField = tableFields.find(f => {
                const n = normalizeKey(f.name);
                return n.includes('eachvalue') || n.startsWith('cal') || n.includes('total') || n.includes('amount') || n.includes('calculatedvalue');
              })?.name;
              const costField = tableFields.find(f => {
                const n = normalizeKey(f.name);
                return n === 'materialtypecost' || n.includes('cost') || n.includes('rate') || n.includes('price');
              })?.name;
              const qtyField = tableFields.find(f => {
                const n = normalizeKey(f.name);
                return n.includes('unit') || n === 'qty' || n === 'quantity';
              })?.name;
              const rowAmt = calField ? parseFloat(row[calField] || '0') : 0;
              const costAmt = costField ? parseFloat(row[costField] || '0') : 0;
              const qtyAmt = qtyField ? parseFloat(row[qtyField] || '0') : 0;

              return (
                <View key={i} style={styles.summaryRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.summaryRowName}>{matName}</Text>
                    {costAmt > 0 && qtyAmt > 0 && (
                      <Text style={styles.summaryCalcNote}>₹{formatIndianNumber(costAmt)} × {qtyAmt} {qtyField ? (tableFields.find(f => f.name === qtyField)?.label || 'units') : 'units'}</Text>
                    )}
                  </View>
                  <Text style={styles.summaryRowAmt}>₹{formatIndianNumber(rowAmt)}</Text>
                </View>
              );
            })}
          </View>

          <View style={styles.summaryDivider} />

          {/* Totals */}
          <View style={styles.totalsBlock}>
            {(calcSettings.includeTax || bal > 0 || paid > 0) && (
              <View style={styles.totalLineRow}>
                <Text style={styles.totalLineLabel}>Materials Subtotal</Text>
                <Text style={styles.totalLineValue}>₹{formatIndianNumber(sub)}</Text>
              </View>
            )}

            {calcSettings.includeTax && tax > 0 && (
              <View style={styles.totalLineRow}>
                <Text style={styles.totalLineLabel}>GST @ {calcSettings.taxRate}%</Text>
                <Text style={styles.totalLineValue}>+ ₹{formatIndianNumber(tax)}</Text>
              </View>
            )}

            {bal > 0 && (
              <>
                {balanceEntries.filter(e => parseFloat(e.amount || '0') > 0).map((e, i) => (
                  <View key={i} style={styles.totalLineRow}>
                    <Text style={styles.totalLineLabel}>
                      Balance #{i + 1}{e.date ? ` (${formatDate(e.date)})` : ''}{e.note ? ` — ${e.note}` : ''}
                    </Text>
                    <Text style={styles.totalLineValue}>+ ₹{formatIndianNumber(parseFloat(e.amount))}</Text>
                  </View>
                ))}
              </>
            )}

            {paid > 0 && (
              <>
                {paidEntries.filter(e => parseFloat(e.amount || '0') > 0).map((e, i) => (
                  <View key={i} style={styles.totalLineRow}>
                    <Text style={[styles.totalLineLabel, { color: Colors.success }]}>
                      Paid #{i + 1}{e.date ? ` (${formatDate(e.date)})` : ''}{e.note ? ` — ${e.note}` : ''}
                    </Text>
                    <Text style={[styles.totalLineValue, { color: Colors.success }]}>− ₹{formatIndianNumber(parseFloat(e.amount))}</Text>
                  </View>
                ))}
              </>
            )}

            <View style={styles.grandTotalRow}>
              <Text style={styles.grandTotalLabel}>Grand Total</Text>
              <Text style={styles.grandTotalValue}>₹{formatIndianNumber(grand)}</Text>
            </View>
          </View>

          {grand < 0 && (
            <View style={styles.warningBox}>
              <Ionicons name="warning-outline" size={16} color="#D97706" />
              <Text style={styles.warningText}>Paid amount exceeds total. Please verify.</Text>
            </View>
          )}
        </StepCard>
      </View>
    );
  };

  const renderStep6 = () => {
    const html = buildPreviewHTML();

    if (Platform.OS === 'web') {
      return (
        <View>
          <StepCard icon="eye-outline" iconBg="#F0F9FF" iconColor="#0EA5E9" title="Bill Preview" subtitle="Live preview of your invoice">
            <View style={styles.webPreviewContainer}>
              <iframe
                srcDoc={html}
                style={{ width: '100%', height: 520, border: 'none', borderRadius: 8, background: '#fff' }}
                title="Bill Preview"
              />
            </View>
            <Text style={styles.previewNote}>
              <Ionicons name="information-circle-outline" size={13} color={Colors.textTertiary} /> This is how your bill will look when printed or saved as PDF.
            </Text>
          </StepCard>
        </View>
      );
    }

    // Native fallback — lightweight React Native preview (reuse existing renderLivePreview logic)
    const themeColor = template?.theme_color || '#1a237e';
    const sub = getSubTotal();
    const bal = getTotalBalance();
    const paid = getTotalPaid();
    const tax = calcSettings.includeTax ? sub * (parseFloat(String(calcSettings.taxRate || 0)) / 100) : 0;
    const grand = sub + bal + tax - paid;
    const billDate = formatDate(getRowValue(headerData, ['billdate', 'date']) || new Date().toISOString());
    const deliveryLoc = getRowValue(headerData, ['deliveryloc', 'place', 'location', 'deliverylocation']) || '';

    const displayTableFields = tableFields.filter(f => {
      const n = normalizeKey(f.name);
      return !(n === 'materialtypecost' || n.includes('priceperunit') || n.includes('priceper') ||
        (n.includes('cost') && !n.includes('total')) || (n.includes('rate') && !n.includes('total')) || n.includes('perunit'));
    });

    return (
      <View>
        <StepCard icon="eye-outline" iconBg="#F0F9FF" iconColor="#0EA5E9" title="Bill Preview" subtitle="Preview of your invoice">
          <ScrollView horizontal showsHorizontalScrollIndicator={true} nestedScrollEnabled>
            <View style={[styles.nativePreviewSheet, { borderColor: themeColor }]}>
              {/* Header */}
              <Text style={[styles.nativePrevShopName, { color: themeColor }]}>{companyName || 'COMPANY NAME'}</Text>
              <Text style={styles.nativePrevSub}>{companyAddress}{companyPhone ? ` | 📞 ${companyPhone}` : ''}</Text>
              <View style={[styles.nativePrevDivider, { backgroundColor: themeColor }]} />

              {/* Customer / Date */}
              <View style={styles.nativePrevInfoRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.nativePrevInfoLabel}>M/s</Text>
                  <Text style={styles.nativePrevInfoVal}>{partyName || '—'}</Text>
                  {customerPhone ? <Text style={styles.nativePrevSmall}>📞 {customerPhone}</Text> : null}
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.nativePrevInfoLabel}>Bill No.</Text>
                  <Text style={styles.nativePrevInfoVal}>{billNumber || '—'}</Text>
                  <Text style={styles.nativePrevInfoLabel}>Date</Text>
                  <Text style={styles.nativePrevInfoVal}>{billDate}</Text>
                  {deliveryLoc ? <Text style={styles.nativePrevSmall}>📍 {deliveryLoc}</Text> : null}
                </View>
              </View>

              {/* Table */}
              <ScrollView horizontal showsHorizontalScrollIndicator nestedScrollEnabled>
                <View style={{ minWidth: 400 }}>
                  <View style={[styles.nativePrevTableHeader, { backgroundColor: themeColor }]}>
                    {displayTableFields.map(f => (
                      <View key={f.name} style={styles.nativePrevHeaderCell}>
                        <Text style={styles.nativePrevHeaderText}>{f.label || f.name}</Text>
                      </View>
                    ))}
                  </View>
                  {rowData.map((row, i) => (
                    <View key={i} style={[styles.nativePrevRow, { backgroundColor: i % 2 === 0 ? '#fff' : '#F8F9FF' }]}>
                      {displayTableFields.map(f => {
                        let val = row[f.name] || '';
                        if ((f.type === 'date' || f.type === 'datetime') && val) val = formatDate(val);
                        const isNum = f.type === 'numeric' || normalizeKey(f.name).startsWith('cal') || normalizeKey(f.name).includes('amount');
                        if (isNum && val) { const n = parseFloat(val); if (!isNaN(n)) val = '₹' + formatIndianNumber(n); }
                        return (
                          <View key={f.name} style={[styles.nativePrevCell, isNum && { alignItems: 'flex-end' }]}>
                            <Text style={styles.nativePrevCellText}>{val}</Text>
                          </View>
                        );
                      })}
                    </View>
                  ))}
                </View>
              </ScrollView>

              {/* Totals */}
              <View style={[styles.nativePrevTotals, { borderColor: themeColor }]}>
                {(calcSettings.includeTax || bal > 0 || paid > 0) && (
                  <View style={styles.nativePrevTotalRow}>
                    <Text style={styles.nativePrevTotalLabel}>Subtotal</Text>
                    <Text style={styles.nativePrevTotalVal}>₹{formatIndianNumber(sub)}</Text>
                  </View>
                )}
                {calcSettings.includeTax && <View style={styles.nativePrevTotalRow}>
                  <Text style={styles.nativePrevTotalLabel}>GST {calcSettings.taxRate}%</Text>
                  <Text style={styles.nativePrevTotalVal}>₹{formatIndianNumber(tax)}</Text>
                </View>}
                {bal > 0 && <View style={styles.nativePrevTotalRow}>
                  <Text style={styles.nativePrevTotalLabel}>Balance</Text>
                  <Text style={styles.nativePrevTotalVal}>₹{formatIndianNumber(bal)}</Text>
                </View>}
                {paid > 0 && <View style={styles.nativePrevTotalRow}>
                  <Text style={[styles.nativePrevTotalLabel, { color: Colors.success }]}>Paid</Text>
                  <Text style={[styles.nativePrevTotalVal, { color: Colors.success }]}>−₹{formatIndianNumber(paid)}</Text>
                </View>}
                <View style={[styles.nativePrevTotalRow, { borderTopWidth: 1, borderTopColor: themeColor, paddingTop: 4, marginTop: 4 }]}>
                  <Text style={[styles.nativePrevTotalLabel, { fontWeight: '900', fontSize: 14 }]}>TOTAL</Text>
                  <Text style={[styles.nativePrevTotalVal, { fontWeight: '900', fontSize: 14, color: themeColor }]}>₹{formatIndianNumber(grand)}</Text>
                </View>
              </View>

              <View style={styles.nativePrevSignature}>
                <Text style={styles.nativePrevSigText}>Receiver's Signature:</Text>
                <View style={[styles.nativePrevSigLine, { borderColor: themeColor }]} />
              </View>
            </View>
          </ScrollView>
          <Text style={styles.previewNote}>Scroll right to see all columns. The actual bill will be generated as a printable PDF.</Text>
        </StepCard>
      </View>
    );
  };

  const renderStep7 = () => {
    const grand = calculateTotal();
    return (
      <View>
        <StepCard icon="save-outline" iconBg="#F0FDF4" iconColor="#22C55E" title="Save & Share" subtitle="Choose how to save or share this bill">
          {/* Grand Total chip */}
          <View style={styles.grandTotalChip}>
            <Text style={styles.grandTotalChipLabel}>Bill Total</Text>
            <Text style={styles.grandTotalChipValue}>₹{formatIndianNumber(grand)}</Text>
          </View>

          {/* Bill info summary */}
          <View style={styles.saveSummaryCard}>
            {partyName ? (
              <View style={styles.saveSummaryRow}>
                <Ionicons name="person-outline" size={14} color={Colors.textSecondary} />
                <Text style={styles.saveSummaryText}>{partyName}</Text>
              </View>
            ) : null}
            {billNumber ? (
              <View style={styles.saveSummaryRow}>
                <Ionicons name="document-outline" size={14} color={Colors.textSecondary} />
                <Text style={styles.saveSummaryText}>Bill #{billNumber}</Text>
              </View>
            ) : null}
            <View style={styles.saveSummaryRow}>
              <Ionicons name="cube-outline" size={14} color={Colors.textSecondary} />
              <Text style={styles.saveSummaryText}>{rowData.length} material line item{rowData.length !== 1 ? 's' : ''}</Text>
            </View>
            {calcSettings.includeTax && (
              <View style={styles.saveSummaryRow}>
                <Ionicons name="pricetag-outline" size={14} color={Colors.textSecondary} />
                <Text style={styles.saveSummaryText}>GST @ {calcSettings.taxRate}% included</Text>
              </View>
            )}
          </View>

          <View style={styles.saveButtonsStack}>
            {/* Save Bill */}
            <TouchableOpacity
              style={[styles.saveActionBtn, styles.saveBtnPrimary]}
              onPress={handleSaveBill}
              disabled={saving && !sharingWhatsApp}
              activeOpacity={0.85}
            >
              <Ionicons name="save-outline" size={20} color="#fff" />
              <View style={{ marginLeft: 10 }}>
                <Text style={styles.saveActionBtnTitle}>Save Bill</Text>
                <Text style={styles.saveActionBtnSub}>Saves to history & generates PDF</Text>
              </View>
              {saving && !sharingWhatsApp && <View style={styles.savingIndicator}><Text style={{ color: '#fff', fontSize: 11 }}>Saving…</Text></View>}
            </TouchableOpacity>

            {/* Save & Share on WhatsApp */}
            <TouchableOpacity
              style={[styles.saveActionBtn, styles.saveBtnWhatsApp]}
              onPress={handleSaveAndShareWhatsAppPress}
              disabled={saving && sharingWhatsApp}
              activeOpacity={0.85}
            >
              <Ionicons name="logo-whatsapp" size={20} color="#fff" />
              <View style={{ marginLeft: 10 }}>
                <Text style={styles.saveActionBtnTitle}>Save & Share on WhatsApp</Text>
                <Text style={styles.saveActionBtnSub}>Saves bill and opens WhatsApp chat</Text>
              </View>
              {saving && sharingWhatsApp && <View style={styles.savingIndicator}><Text style={{ color: '#fff', fontSize: 11 }}>Sharing…</Text></View>}
            </TouchableOpacity>

            {/* Generate Only */}
            <TouchableOpacity
              style={[styles.saveActionBtn, styles.saveBtnGenerate]}
              onPress={handleGenerateOnly}
              disabled={generating}
              activeOpacity={0.85}
            >
              <Ionicons name="document-outline" size={20} color={Colors.primary} />
              <View style={{ marginLeft: 10 }}>
                <Text style={[styles.saveActionBtnTitle, { color: Colors.primary }]}>Generate Bill Only</Text>
                <Text style={[styles.saveActionBtnSub, { color: Colors.textSecondary }]}>Preview/print without saving to history</Text>
              </View>
              {generating && <View style={styles.savingIndicator}><Text style={{ color: Colors.primary, fontSize: 11 }}>Generating…</Text></View>}
            </TouchableOpacity>
          </View>

          <View style={styles.saveNote}>
            <Ionicons name="cloud-outline" size={14} color={Colors.textTertiary} />
            <Text style={styles.saveNoteText}>Your draft is auto-saved locally. You can resume it anytime from Leftover Bills.</Text>
          </View>
        </StepCard>
      </View>
    );
  };

  const renderCurrentStep = () => {
    switch (currentStep) {
      case 0: return renderStep0();
      case 1: return renderStep1();
      case 2: return renderStep2();
      case 3: return renderStep3();
      case 4: return renderStep4();
      case 5: return renderStep5();
      case 6: return renderStep6();
      case 7: return renderStep7();
      default: return null;
    }
  };

  if (!template) {
    return (
      <View style={[styles.container, { paddingTop: insets.top, justifyContent: 'center', alignItems: 'center' }]}>
        <Ionicons name="document-text-outline" size={48} color={Colors.textTertiary} style={{ marginBottom: 16 }} />
        <Text style={{ color: Colors.textTertiary, fontSize: 16 }}>Loading bill form…</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* ── Top Bar ── */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={handleMinimizeBill} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.text} />
        </TouchableOpacity>
        <View style={{ flex: 1, marginHorizontal: 12 }}>
          <Text style={styles.topBarTitle} numberOfLines={1}>{isEditing ? 'Edit Bill' : 'New Bill'}</Text>
          <Text style={styles.topBarSub} numberOfLines={1}>{STEPS[currentStep].label} · {template.name}</Text>
        </View>
        <TouchableOpacity
          style={styles.minimizeBtn}
          onPress={handleMinimizeBill}
        >
          <Ionicons name="remove-outline" size={16} color={Colors.primary} />
          <Text style={styles.minimizeBtnText}>Minimize</Text>
        </TouchableOpacity>
      </View>

      {/* ── Step Progress Bar ── */}
      <StepProgressBar currentStep={currentStep} totalSteps={STEPS.length} onStepPress={setCurrentStep} />

      {/* ── Step Content ── */}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {renderCurrentStep()}
          <View style={{ height: 20 }} />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* ── Step Navigation Footer ── */}
      <View style={styles.navFooter}>
        <TouchableOpacity
          style={[styles.navBtn, styles.navBtnPrev, currentStep === 0 && styles.navBtnDisabled]}
          onPress={goPrev}
          disabled={currentStep === 0}
        >
          <Ionicons name="chevron-back" size={18} color={currentStep === 0 ? Colors.textTertiary : Colors.primary} />
          <Text style={[styles.navBtnText, { color: currentStep === 0 ? Colors.textTertiary : Colors.primary }]}>Previous</Text>
        </TouchableOpacity>

        <View style={styles.navStepIndicator}>
          <Text style={styles.navStepText}>{currentStep + 1} / {STEPS.length}</Text>
        </View>

        {currentStep < STEPS.length - 1 ? (
          <TouchableOpacity style={[styles.navBtn, styles.navBtnNext]} onPress={goNext}>
            <Text style={styles.navBtnNextText}>Next</Text>
            <Ionicons name="chevron-forward" size={18} color="#fff" />
          </TouchableOpacity>
        ) : (
          <View style={[styles.navBtn, { opacity: 0 }]} />
        )}
      </View>

      {/* ── Materials Modal ── */}
      <Modal visible={materialModalVisible} animationType="slide" transparent onRequestClose={() => setMaterialModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="cube-outline" size={20} color={Colors.primary} />
                <Text style={styles.modalTitle}>Select Material</Text>
              </View>
              <TouchableOpacity onPress={() => setMaterialModalVisible(false)}>
                <Ionicons name="close" size={24} color={Colors.text} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalList} showsVerticalScrollIndicator={false}>
              {materials.map(m => (
                <TouchableOpacity key={m.id} style={styles.modalItem} onPress={() => selectMaterial(m)}>
                  <View style={styles.modalItemIcon}><Ionicons name="cube-outline" size={18} color={Colors.primary} /></View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.modalItemText}>{m.name}</Text>
                    <Text style={styles.modalItemSub}>₹{m.price_per_unit} / {m.unit_type || 'unit'}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={Colors.textTertiary} />
                </TouchableOpacity>
              ))}
              {!showCustomMaterialForm ? (
                <TouchableOpacity style={[styles.modalItem, { borderBottomWidth: 0, marginTop: 8 }]} onPress={() => setShowCustomMaterialForm(true)}>
                  <View style={[styles.modalItemIcon, { backgroundColor: Colors.successLight }]}><Ionicons name="add-circle" size={18} color={Colors.success} /></View>
                  <Text style={[styles.modalItemText, { color: Colors.success }]}>+ Add New Material On-The-Go</Text>
                </TouchableOpacity>
              ) : (
                <View style={styles.customMaterialForm}>
                  <Text style={styles.customMaterialFormTitle}>New Material</Text>
                  <Input label="Material Name *" value={customMaterialInput} onChangeText={setCustomMaterialInput} placeholder="e.g. P-Sand Grade B" icon="cube-outline" />
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <View style={{ flex: 1 }}>
                      <Input label="Price per Unit (₹) *" value={customPriceInput} onChangeText={setCustomPriceInput} placeholder="2800" keyboardType="numeric" icon="cash-outline" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Input label="Unit Type" value={customUnitInput} onChangeText={setCustomUnitInput} placeholder="ton / cft / unit" icon="options-outline" />
                    </View>
                  </View>
                  <Button title={savingCustomMaterial ? "Saving…" : "Save & Select"} onPress={handleSaveMaterialOnTheGo} disabled={savingCustomMaterial} variant="success" fullWidth style={{ marginTop: 6 }} />
                </View>
              )}
              <View style={{ height: 40 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ── Customer Modal ── */}
      <Modal visible={customerModalVisible} animationType="slide" transparent onRequestClose={() => setCustomerModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="people-outline" size={20} color={Colors.primary} />
                <Text style={styles.modalTitle}>Select Customer</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <TouchableOpacity
                  style={styles.addOnTheFlyBtn}
                  onPress={() => { setNewCustName(customerSearchQuery); setShowAddCustomerForm(!showAddCustomerForm); }}
                >
                  <Ionicons name={showAddCustomerForm ? "list" : "add-circle"} size={15} color={Colors.primary} />
                  <Text style={styles.addOnTheFlyBtnText}>{showAddCustomerForm ? "View List" : "+ Add New"}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setCustomerModalVisible(false)}>
                  <Ionicons name="close" size={24} color={Colors.text} />
                </TouchableOpacity>
              </View>
            </View>

            {showAddCustomerForm ? (
              <View style={{ padding: 20 }}>
                <Text style={styles.customMaterialFormTitle}>Add Customer On-The-Go</Text>
                <Input label="Customer Name *" value={newCustName} onChangeText={setNewCustName} placeholder="e.g. Anand Construction" icon="person-outline" />
                <Input label="Phone (Optional)" value={newCustPhone} onChangeText={setNewCustPhone} placeholder="9876543210" keyboardType="phone-pad" icon="call-outline" />
                <Input label="Address (Optional)" value={newCustAddress} onChangeText={setNewCustAddress} placeholder="Delivery address..." icon="home-outline" />
                <Button title={savingNewCustomer ? "Saving…" : "Save & Select"} onPress={handleCreateCustomerOnTheGo} disabled={savingNewCustomer} variant="success" fullWidth style={{ marginTop: 10 }} />
              </View>
            ) : (
              <>
                <View style={{ paddingHorizontal: 20, paddingBottom: 10 }}>
                  <Input value={customerSearchQuery} onChangeText={setCustomerSearchQuery} placeholder="Search customers..." icon="search-outline" />
                </View>
                <ScrollView style={styles.modalList} showsVerticalScrollIndicator={false}>
                  {customers.filter(c =>
                    c.name.toLowerCase().includes(customerSearchQuery.toLowerCase()) ||
                    (c.phone && c.phone.includes(customerSearchQuery))
                  ).map(c => (
                    <TouchableOpacity key={c.id} style={styles.modalItem} onPress={() => selectCustomer(c)}>
                      <View style={[styles.modalItemIcon, { backgroundColor: c.isEnquiry ? '#DCFCE7' : '#EBF5FB' }]}>
                        <Ionicons name={c.isEnquiry ? "chatbubbles" : "person-outline"} size={18} color={c.isEnquiry ? "#16A34A" : Colors.primary} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.modalItemText}>{c.name}</Text>
                        {c.phone ? <Text style={styles.modalItemSub}>📞 {c.phone}</Text> : null}
                        {c.address ? <Text style={styles.modalItemSub} numberOfLines={1}>📍 {c.address}</Text> : null}
                      </View>
                      <Ionicons name="chevron-forward" size={16} color={Colors.textTertiary} />
                    </TouchableOpacity>
                  ))}
                  {customers.filter(c =>
                    c.name.toLowerCase().includes(customerSearchQuery.toLowerCase()) ||
                    (c.phone && c.phone.includes(customerSearchQuery))
                  ).length === 0 && (
                    <View style={{ padding: 24, alignItems: 'center' }}>
                      <Ionicons name="person-add-outline" size={40} color={Colors.textTertiary} style={{ marginBottom: 10 }} />
                      <Text style={{ color: Colors.textSecondary, textAlign: 'center', marginBottom: 14, fontSize: 14 }}>
                        No customers found for "{customerSearchQuery || 'your search'}".
                      </Text>
                      <Button
                        title={customerSearchQuery ? `+ Add "${customerSearchQuery}"` : "+ Add Customer"}
                        onPress={() => { setNewCustName(customerSearchQuery); setShowAddCustomerForm(true); }}
                        variant="primary"
                      />
                    </View>
                  )}
                  <View style={{ height: 40 }} />
                </ScrollView>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* ── WhatsApp Modal ── */}
      <Modal visible={whatsappModalVisible} animationType="slide" transparent onRequestClose={() => setWhatsappModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { maxHeight: 340 }]}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="logo-whatsapp" size={22} color="#25D366" />
                <Text style={styles.modalTitle}>Confirm WhatsApp Number</Text>
              </View>
              <TouchableOpacity onPress={() => setWhatsappModalVisible(false)}>
                <Ionicons name="close" size={24} color={Colors.text} />
              </TouchableOpacity>
            </View>
            <View style={{ paddingHorizontal: 24, paddingVertical: 20 }}>
              <Text style={{ color: Colors.textSecondary, marginBottom: 16, fontSize: 14 }}>
                Send this invoice PDF to a WhatsApp number. Edit if needed.
              </Text>
              <Input label="WhatsApp Number (10 digits)" value={whatsappPhone} onChangeText={setWhatsappPhone} placeholder="Enter 10-digit number" keyboardType="phone-pad" icon="call-outline" />
              <View style={{ flexDirection: 'row', gap: 12, marginTop: 12 }}>
                <Button title="Cancel" onPress={() => setWhatsappModalVisible(false)} variant="secondary" style={{ flex: 1 }} />
                <Button title="Send Invoice" onPress={confirmSaveAndShareWhatsApp} variant="success" style={{ flex: 1.2 }} icon="send" />
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Draft Resume Modal ── */}
      <Modal visible={draftModalVisible} animationType="fade" transparent onRequestClose={() => setDraftModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { maxHeight: 380, borderTopLeftRadius: 24, borderTopRightRadius: 24 }]}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="time-outline" size={24} color={Colors.accent} />
                <Text style={styles.modalTitle}>Leftover Bill Found</Text>
              </View>
            </View>
            <View style={{ paddingHorizontal: 24, paddingVertical: 20 }}>
              <Text style={{ color: Colors.textSecondary, marginBottom: 20, fontSize: 14, lineHeight: 22 }}>
                You have an unfinished bill draft saved for this template. Resume where you left off, or start fresh?
              </Text>
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <Button title="Start Fresh" onPress={async () => { await clearDraft(templateId, companyId); setDraftModalVisible(false); }} variant="outline" style={{ flex: 1 }} />
                <Button title="Resume Draft" onPress={() => {
                  if (savedDraftData) {
                    if (savedDraftData.headerData) setHeaderData(savedDraftData.headerData);
                    if (savedDraftData.rowData) setRowData(savedDraftData.rowData);
                    if (savedDraftData.calcSettings) setCalcSettings(savedDraftData.calcSettings);
                    if (savedDraftData.customerPhone) setCustomerPhone(savedDraftData.customerPhone);
                    if (savedDraftData.customerAddress) setCustomerAddress(savedDraftData.customerAddress);
                    if (savedDraftData.balanceEntries) setBalanceEntries(savedDraftData.balanceEntries);
                    if (savedDraftData.paidEntries) setPaidEntries(savedDraftData.paidEntries);
                  }
                  setDraftModalVisible(false);
                }} variant="primary" style={{ flex: 1 }} icon="play-outline" />
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ─── StepCard Sub-Component ───────────────────────────────────────────────────
function StepCard({ icon, iconBg, iconColor, title, subtitle, children }) {
  return (
    <View style={styles.stepCard}>
      <View style={styles.stepCardHeader}>
        <View style={[styles.stepCardIconCircle, { backgroundColor: iconBg }]}>
          <Ionicons name={icon} size={22} color={iconColor} />
        </View>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.stepCardTitle}>{title}</Text>
          {subtitle && <Text style={styles.stepCardSubtitle}>{subtitle}</Text>}
        </View>
      </View>
      <View style={styles.stepCardBody}>{children}</View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },

  // Top Bar
  topBar: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1, borderBottomColor: Colors.borderLight,
  },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.background, alignItems: 'center', justifyContent: 'center' },
  topBarTitle: { fontSize: 17, fontWeight: '700', color: Colors.text },
  topBarSub: { fontSize: 12, color: Colors.textTertiary, marginTop: 1 },
  minimizeBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.primarySurface, paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 8,
  },
  minimizeBtnText: { fontSize: 12, fontWeight: '700', color: Colors.primary },

  // Progress Bar
  progressBarContainer: {
    backgroundColor: Colors.surface,
    borderBottomWidth: 1, borderBottomColor: Colors.borderLight,
    paddingVertical: 10,
  },
  progressBarScroll: { paddingHorizontal: 16, gap: 0 },
  progressStep: {
    flexDirection: 'row', alignItems: 'center',
  },
  progressDot: {
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: Colors.background,
    borderWidth: 1.5, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  progressDotActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  progressDotCompleted: { backgroundColor: Colors.success, borderColor: Colors.success },
  progressDotText: { fontSize: 11, fontWeight: '700', color: Colors.textTertiary },
  progressDotTextActive: { color: '#fff' },
  progressLabel: { fontSize: 10, color: Colors.textTertiary, marginHorizontal: 4, maxWidth: 50, textAlign: 'center' },
  progressLabelActive: { color: Colors.primary, fontWeight: '700' },
  progressLabelCompleted: { color: Colors.success },
  progressConnector: { width: 16, height: 2, backgroundColor: Colors.border, marginHorizontal: 2 },
  progressConnectorCompleted: { backgroundColor: Colors.success },

  // Scroll
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 32 },

  // Step Card
  stepCard: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    borderWidth: 1, borderColor: Colors.borderLight,
    marginBottom: 16,
    overflow: 'hidden',
  },
  stepCardHeader: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 18, paddingTop: 18, paddingBottom: 14,
    borderBottomWidth: 1, borderBottomColor: Colors.borderLight,
  },
  stepCardIconCircle: {
    width: 44, height: 44, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  stepCardTitle: { fontSize: 17, fontWeight: '700', color: Colors.text },
  stepCardSubtitle: { fontSize: 12, color: Colors.textTertiary, marginTop: 2 },
  stepCardBody: { padding: 18 },

  // Fields
  fieldBlock: { marginBottom: 16 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary, marginBottom: 6 },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  optionalTag: { fontWeight: '400', color: Colors.textTertiary, fontSize: 11 },
  input: {
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1.5, borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, color: Colors.text,
    minHeight: 50,
  },
  inputCalc: {
    backgroundColor: Colors.successLight,
    borderColor: Colors.successBorder,
    color: Colors.success,
    fontWeight: '700',
  },
  billNoRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  autoTag: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.primarySurface,
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 8,
  },
  autoTagText: { fontSize: 11, fontWeight: '700', color: Colors.primary },
  pillBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.primarySurface,
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1, borderColor: Colors.primaryBorder,
  },
  pillBtnText: { fontSize: 12, fontWeight: '600', color: Colors.primary },

  // Material Cards
  materialCard: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 14, padding: 14,
    marginBottom: 14,
    borderWidth: 1.5, borderColor: Colors.borderLight,
  },
  materialCardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 8 },
  materialCardBadge: { backgroundColor: Colors.primary, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  materialCardBadgeText: { fontSize: 12, fontWeight: '700', color: '#fff' },
  materialCardTitle: { flex: 1, fontSize: 15, fontWeight: '700', color: Colors.text },
  materialCardHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowAmountBadge: { backgroundColor: Colors.successLight, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1, borderColor: Colors.successBorder },
  rowAmountText: { fontSize: 12, fontWeight: '700', color: Colors.success },
  removeBtn: { padding: 4 },
  chipsScroll: { marginBottom: 10 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.surface, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, borderWidth: 1, borderColor: Colors.border },
  chipActive: { backgroundColor: Colors.primarySurface, borderColor: Colors.primaryBorder },
  chipText: { fontSize: 12, color: Colors.textSecondary },
  chipTextActive: { color: Colors.primary, fontWeight: '700' },
  fieldsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  fieldGridItem: { marginBottom: 2 },
  fieldFullWidth: { width: '100%' },
  fieldHalfWidth: { width: '48%' },
  dropdownBtn: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1.5, borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 12, minHeight: 50,
    gap: 6,
  },
  dropdownBtnText: { flex: 1, fontSize: 15, color: Colors.text },
  placeholderText: { color: Colors.textTertiary },

  addItemBtn: {
    borderRadius: 12, borderWidth: 1.5, borderStyle: 'dashed',
    borderColor: Colors.accent, marginTop: 4,
    overflow: 'hidden',
  },
  addItemBtnInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14 },
  addItemBtnText: { fontSize: 15, fontWeight: '600', color: Colors.accent },
  runningTotal: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: Colors.primarySurface,
    borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12,
    marginTop: 14,
  },
  runningTotalLabel: { fontSize: 14, fontWeight: '600', color: Colors.primary },
  runningTotalValue: { fontSize: 18, fontWeight: '800', color: Colors.primary },

  // Payment Entries
  paymentEntryCard: { backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: Colors.borderLight },
  paymentEntryHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  entryBadge: { backgroundColor: '#FEF3C7', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  entryBadgeText: { fontSize: 12, fontWeight: '700', color: '#92400E' },
  paymentRowFields: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  addEntryBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: 10, borderWidth: 1.5, borderStyle: 'dashed', borderColor: '#D97706', marginTop: 4 },

  // Settings
  formulaBox: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: 'rgba(59,130,246,0.08)', borderRadius: 12, padding: 14, marginBottom: 18, borderWidth: 1, borderColor: 'rgba(59,130,246,0.2)' },
  formulaTitle: { fontSize: 13, fontWeight: '700', color: '#3B82F6', marginBottom: 4 },
  formulaText: { fontSize: 12, color: Colors.textSecondary, lineHeight: 18 },
  settingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14 },
  settingTextContainer: { flex: 1, paddingRight: 16 },
  settingLabel: { fontSize: 15, fontWeight: '600', color: Colors.text },
  settingDesc: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  settingDivider: { height: 1, backgroundColor: Colors.divider, marginVertical: 4 },
  gstInputRow: { flexDirection: 'row', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginTop: 6 },
  gstRateChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, backgroundColor: Colors.surface, borderWidth: 1.5, borderColor: Colors.border },
  gstRateChipActive: { backgroundColor: Colors.primarySurface, borderColor: Colors.primary },
  gstRateText: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
  gstRateTextActive: { color: Colors.primary },

  // Summary
  summarySection: { marginBottom: 16 },
  summarySectionTitle: { fontSize: 14, fontWeight: '700', color: Colors.text, marginBottom: 10 },
  summaryRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Colors.divider },
  summaryRowName: { fontSize: 14, fontWeight: '600', color: Colors.text },
  summaryCalcNote: { fontSize: 11, color: Colors.textTertiary, marginTop: 2 },
  summaryRowAmt: { fontSize: 15, fontWeight: '700', color: Colors.text },
  summaryDivider: { height: 1, backgroundColor: Colors.border, marginVertical: 14 },
  totalsBlock: { gap: 8 },
  totalLineRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 },
  totalLineLabel: { fontSize: 13, color: Colors.textSecondary, flex: 1 },
  totalLineValue: { fontSize: 14, fontWeight: '600', color: Colors.text },
  grandTotalRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: Colors.primarySurface,
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
    marginTop: 6,
  },
  grandTotalLabel: { fontSize: 16, fontWeight: '800', color: Colors.primary },
  grandTotalValue: { fontSize: 22, fontWeight: '900', color: Colors.primary },
  warningBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FEF3C7', borderRadius: 10, padding: 12, marginTop: 10 },
  warningText: { fontSize: 13, color: '#92400E', flex: 1 },

  // Preview
  webPreviewContainer: { borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: Colors.border },
  previewNote: { fontSize: 11, color: Colors.textTertiary, marginTop: 10, textAlign: 'center' },
  nativePreviewSheet: { backgroundColor: '#fff', padding: 16, borderRadius: 8, borderWidth: 1.5, minWidth: SCREEN_WIDTH - 60 },
  nativePrevShopName: { fontSize: 20, fontWeight: '900', textAlign: 'center', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 2 },
  nativePrevSub: { fontSize: 11, color: '#555', textAlign: 'center', marginBottom: 8 },
  nativePrevDivider: { height: 2, width: '100%', marginBottom: 12 },
  nativePrevInfoRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 14 },
  nativePrevInfoLabel: { fontSize: 10, color: '#888', fontWeight: '600', marginBottom: 2 },
  nativePrevInfoVal: { fontSize: 13, fontWeight: '700', color: '#111' },
  nativePrevSmall: { fontSize: 11, color: '#555', marginTop: 2 },
  nativePrevTableHeader: { flexDirection: 'row' },
  nativePrevHeaderCell: { flex: 1, padding: 6, minWidth: 70 },
  nativePrevHeaderText: { fontSize: 11, fontWeight: '700', color: '#fff', textAlign: 'center' },
  nativePrevRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#eee' },
  nativePrevCell: { flex: 1, padding: 6, minWidth: 70, justifyContent: 'center' },
  nativePrevCellText: { fontSize: 11, color: '#111' },
  nativePrevTotals: { alignSelf: 'flex-end', minWidth: 200, borderWidth: 1, borderRadius: 4, padding: 8, gap: 4, marginTop: 8 },
  nativePrevTotalRow: { flexDirection: 'row', justifyContent: 'space-between' },
  nativePrevTotalLabel: { fontSize: 12, fontWeight: '700', color: '#333' },
  nativePrevTotalVal: { fontSize: 12, fontWeight: '700', color: '#333' },
  nativePrevSignature: { flexDirection: 'row', alignItems: 'flex-end', marginTop: 28 },
  nativePrevSigText: { fontSize: 11, fontWeight: '700', color: '#333' },
  nativePrevSigLine: { flex: 1, borderBottomWidth: 1, marginLeft: 8, marginBottom: 2 },

  // Save Step
  grandTotalChip: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: Colors.primary, borderRadius: 14, paddingHorizontal: 18, paddingVertical: 16,
    marginBottom: 16,
  },
  grandTotalChipLabel: { fontSize: 14, fontWeight: '600', color: 'rgba(255,255,255,0.8)' },
  grandTotalChipValue: { fontSize: 26, fontWeight: '900', color: '#fff' },
  saveSummaryCard: { backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: 14, marginBottom: 20, gap: 8 },
  saveSummaryRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  saveSummaryText: { fontSize: 13, color: Colors.textSecondary },
  saveButtonsStack: { gap: 12 },
  saveActionBtn: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 16, paddingHorizontal: 18, paddingVertical: 16,
    position: 'relative',
  },
  saveBtnPrimary: { backgroundColor: Colors.primary },
  saveBtnWhatsApp: { backgroundColor: '#25D366' },
  saveBtnGenerate: { backgroundColor: Colors.primarySurface, borderWidth: 1.5, borderColor: Colors.primaryBorder },
  saveActionBtnTitle: { fontSize: 15, fontWeight: '700', color: '#fff' },
  saveActionBtnSub: { fontSize: 11, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
  savingIndicator: { position: 'absolute', right: 16 },
  saveNote: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 16 },
  saveNoteText: { fontSize: 12, color: Colors.textTertiary, flex: 1 },

  // Nav Footer
  navFooter: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: Colors.surface,
    borderTopWidth: 1, borderTopColor: Colors.borderLight,
    paddingBottom: 20,
  },
  navBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, minWidth: 100,
  },
  navBtnPrev: { backgroundColor: Colors.primarySurface },
  navBtnNext: { backgroundColor: Colors.primary, justifyContent: 'flex-end' },
  navBtnDisabled: { opacity: 0.3 },
  navBtnText: { fontSize: 14, fontWeight: '700' },
  navBtnNextText: { fontSize: 14, fontWeight: '700', color: '#fff' },
  navStepIndicator: { backgroundColor: Colors.background, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  navStepText: { fontSize: 13, fontWeight: '700', color: Colors.textSecondary },

  // Modals
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    maxHeight: '80%', paddingBottom: 34,
  },
  modalHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: Colors.border, alignSelf: 'center', marginTop: 10, marginBottom: 4 },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  modalTitle: { fontSize: 17, fontWeight: '700', color: Colors.text },
  modalList: { paddingHorizontal: 20, paddingTop: 10 },
  modalItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.divider },
  modalItemIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: Colors.primarySurface, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  modalItemText: { fontSize: 15, fontWeight: '600', color: Colors.text },
  modalItemSub: { fontSize: 12, color: Colors.textTertiary, marginTop: 2 },
  customMaterialForm: { padding: 14, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 12, marginTop: 10 },
  customMaterialFormTitle: { fontSize: 15, fontWeight: '700', color: Colors.text, marginBottom: 10 },
  addOnTheFlyBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.primarySurface, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  addOnTheFlyBtnText: { fontSize: 12, fontWeight: '700', color: Colors.primary },
});
