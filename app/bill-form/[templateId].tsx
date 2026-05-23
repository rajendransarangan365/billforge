// @ts-nocheck
import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, Alert, KeyboardAvoidingView, Platform,
  TextInput, Modal, Switch,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius } from '../../src/theme';
import { Card, Button, Input, DateTimePickerInput } from '../../src/components';
import { 
  getDatabase, getTemplateById, getCompanyProfile, saveBill, 
  updateBillPdfUri, getNextBillNumber, getMaterials, getCustomers, saveCustomer
} from '../../src/database/db';
import { getKeyboardTypeForField } from '../../src/services/templateParser';
import { generatePDF, sharePDF, savePDFPermanently } from '../../src/services/pdfGenerator';

const normalizeKey = (key: string) => key ? key.toLowerCase().replace(/[\s_-]/g, '') : '';

const getRowValue = (row: any, targetNames: string[]) => {
  const normalizedTargets = targetNames.map(t => normalizeKey(t));
  const matchedKey = Object.keys(row).find(k => normalizedTargets.includes(normalizeKey(k)));
  return matchedKey ? row[matchedKey] : undefined;
};

export default function BillFormScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { templateId } = useLocalSearchParams();
  const [template, setTemplate] = useState(null);
  const [headerFields, setHeaderFields] = useState([]);
  const [tableFields, setTableFields] = useState([]);
  const [headerData, setHeaderData] = useState({});
  const [rowData, setRowData] = useState([{}]);
  const [companyProfile, setCompanyProfile] = useState({});
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [whatsappModalVisible, setWhatsappModalVisible] = useState(false);
  const [whatsappPhone, setWhatsappPhone] = useState('');
  const [sharingWhatsApp, setSharingWhatsApp] = useState(false);

  const [calcSettings, setCalcSettings] = useState({
    multiplyTrip: true,
    includeTax: false,
    taxRate: 18,
    showTimeInTable: false,
  });

  const recalculateAllRows = (settings) => {
    setRowData(prev => {
      return prev.map(row => {
        const updatedRow = { ...row };
        const tripVal = parseFloat(getRowValue(updatedRow, ['trip', 'trips']) || '0');
        const qtyVal = parseFloat(getRowValue(updatedRow, ['unit', 'units', 'qty', 'quantity']) || '0');
        
        let unitVal = 0;
        if (settings.multiplyTrip) {
          if (!isNaN(tripVal) && tripVal > 0 && !isNaN(qtyVal) && qtyVal > 0) {
            unitVal = tripVal * qtyVal;
          } else if (!isNaN(qtyVal) && qtyVal > 0) {
            unitVal = qtyVal;
          } else if (!isNaN(tripVal) && tripVal > 0) {
            unitVal = tripVal;
          }
        } else {
          if (!isNaN(qtyVal) && qtyVal > 0) {
            unitVal = qtyVal;
          }
        }

        const costFieldName = Object.keys(updatedRow).find(k => {
          const norm = normalizeKey(k);
          return norm.includes('cost') || norm.includes('value') || norm.includes('price') || norm.includes('rate');
        }) || 'MaterialTypeCost';
        
        let costVal = parseFloat(updatedRow[costFieldName] || '0');
        
        const calFieldName = Object.keys(updatedRow).find(k => {
          const norm = normalizeKey(k);
          return norm.startsWith('cal') || norm.includes('total') || norm.includes('amount');
        });

        if (calFieldName) {
          if (!isNaN(unitVal) && !isNaN(costVal)) {
            updatedRow[calFieldName] = String(unitVal * costVal);
          }
        }
        
        return updatedRow;
      });
    });
  };

  // Material selection modal states
  const [materialModalVisible, setMaterialModalVisible] = useState(false);
  const [activeRowIdx, setActiveRowIdx] = useState(null);
  const [activeFieldKey, setActiveFieldKey] = useState('');
  const [customMaterialInput, setCustomMaterialInput] = useState('');
  const [showCustomMaterialForm, setShowCustomMaterialForm] = useState(false);

  // Customer directory selection modal states
  const [customers, setCustomers] = useState([]);
  const [customerModalVisible, setCustomerModalVisible] = useState(false);
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [customerSearchQuery, setCustomerSearchQuery] = useState('');
  const [activeCustomerField, setActiveCustomerField] = useState('');

  useEffect(() => {
    loadTemplate();
    loadBillNumber();
    loadMaterials();
    loadCustomers();
  }, [templateId]);

  const loadCustomers = async () => {
    try {
      const db = await getDatabase();
      const list = await getCustomers(db);
      setCustomers(list);
    } catch (error) {
      console.error('Error loading customers:', error);
    }
  };

  const loadBillNumber = async () => {
    try {
      const db = await getDatabase();
      const nextBn = await getNextBillNumber(db);
      setHeaderData(prev => {
        const updated = { ...prev };
        const bnField = headerFields.find(f => {
          const norm = normalizeKey(f.name);
          return norm === 'bn' || norm === 'billnumber' || norm === 'billno';
        });
        if (bnField) {
          updated[bnField.name] = nextBn;
        } else {
          updated['BN'] = nextBn;
        }
        return updated;
      });
    } catch (error) {
      console.error('Error loading bill number:', error);
    }
  };

  const [materials, setMaterials] = useState([]);
  const loadMaterials = async () => {
    try {
      const db = await getDatabase();
      const list = await getMaterials(db);
      setMaterials(list);
    } catch (error) {
      console.error('Error loading materials:', error);
    }
  };

  const loadTemplate = async () => {
    try {
      const db = await getDatabase();
      const t = await getTemplateById(db, parseInt(templateId));
      if (t) {
        setTemplate(t);
        const hFields = JSON.parse(t.header_fields_json || '[]');
        let tFields = JSON.parse(t.table_fields_json || '[]');
        
        // Dynamic virtual field injection for MaterialTypeCost if missing
        const hasCostField = tFields.some(f => {
          const norm = normalizeKey(f.name);
          return norm.includes('cost') || norm.includes('rate') || norm.includes('price') || norm.includes('value');
        });
        if (!hasCostField) {
          const matIdx = tFields.findIndex(f => ['materialtype', 'materialstype', 'material', 'materials'].includes(normalizeKey(f.name)));
          const virtualCostField = {
            name: 'MaterialTypeCost',
            label: 'Price per Unit (₹)',
            type: 'numeric',
            isVirtual: true
          };
          if (matIdx !== -1) {
            tFields.splice(matIdx + 1, 0, virtualCostField);
          } else {
            tFields.push(virtualCostField);
          }
        }

        setHeaderFields(hFields);
        setTableFields(tFields);
               // Load company profile and sequential bill number
        const profile = await getCompanyProfile(db);
        if (profile) {
          setCompanyProfile(profile);
        }
        const nextBn = await getNextBillNumber(db);

        // Initialize header data with current date for date/datetime fields and prefilled values
        const hData = {};
        hFields.forEach(f => { 
          const norm = normalizeKey(f.name);
          if (f.type === 'date' || f.type === 'datetime') {
            hData[f.name] = new Date().toISOString();
          } else if (norm === 'bn' || norm === 'billnumber' || norm === 'billno') {
            hData[f.name] = nextBn;
          } else if (profile && (norm === 'shopname' || norm === 'companyname')) {
            hData[f.name] = profile.name || '';
          } else if (profile && (norm === 'shoplocation' || norm === 'shopaddress' || norm === 'address')) {
            hData[f.name] = profile.location || profile.address || '';
          } else if (profile && (norm === 'shopnumber' || norm === 'shopphone' || norm === 'phone')) {
            hData[f.name] = profile.phone || '';
          } else {
            hData[f.name] = ''; 
          }
        });
        
        // Initialize one empty row with current date/time preset
        const rowInit = {};
        tFields.forEach(f => { 
          if (f.type === 'date' || f.type === 'datetime' || f.type === 'time') {
            rowInit[f.name] = new Date().toISOString();
          } else {
            rowInit[f.name] = ''; 
          }
        });
        
        // Auto-fill Sno for the first row
        const snoField = tFields.find(f => {
          const norm = normalizeKey(f.name);
          return norm === 'sno' || norm === 'slno';
        });
        if (snoField) {
          rowInit[snoField.name] = '1';
        }
        
        setRowData([{ ...rowInit }]);
        setHeaderData(hData);
      }
    } catch (error) {
      console.error('Error loading template:', error);
    }
  };

  // Auto-sync serial numbers when rows change
  useEffect(() => {
    const snoField = tableFields.find(f => {
      const norm = normalizeKey(f.name);
      return norm === 'sno' || norm === 'slno';
    });
    if (snoField) {
      setRowData(prev => {
        let changed = false;
        const updated = prev.map((row, idx) => {
          const expectedSno = String(idx + 1);
          if (row[snoField.name] !== expectedSno) {
            changed = true;
            return { ...row, [snoField.name]: expectedSno };
          }
          return row;
        });
        return changed ? updated : prev;
      });
    }
    
    // Also trigger total calculation
    calculateTotal();
  }, [rowData.length]);

  const updateHeaderField = (fieldName, value) => {
    setHeaderData(prev => ({ ...prev, [fieldName]: value }));
  };

  const updateRowField = (rowIndex, fieldName, value) => {
    setRowData(prev => {
      const updated = [...prev];
      const row = { ...updated[rowIndex], [fieldName]: value };
      
      const normalizedFieldName = normalizeKey(fieldName);

      // Material auto-fill logic (matches materialtype, materialstype, material, materials)
      const isMaterialField = ['materialtype', 'materialstype', 'material', 'materials'].includes(normalizedFieldName);
      
      // Find cost/price/rate field
      const costFieldName = Object.keys(row).find(k => {
        const norm = normalizeKey(k);
        return norm.includes('cost') || norm.includes('value') || norm.includes('price') || norm.includes('rate');
      }) || 'MaterialTypeCost';

      if (isMaterialField) {
        const material = materials.find(m => normalizeKey(m.name) === normalizeKey(value));
        if (material) {
          row[costFieldName] = String(material.price_per_unit);
        }
      }

      // Calculate unit value adaptively based on Trip and Units/Qty
      let unitVal = 0;
      const tripVal = parseFloat(getRowValue(row, ['trip', 'trips']) || '0');
      const qtyVal = parseFloat(getRowValue(row, ['unit', 'units', 'qty', 'quantity']) || '0');
      
      if (calcSettings.multiplyTrip) {
        if (!isNaN(tripVal) && tripVal > 0 && !isNaN(qtyVal) && qtyVal > 0) {
          // If both Trip and Units are present and non-zero, total quantity is Trip * Units
          unitVal = tripVal * qtyVal;
        } else if (!isNaN(qtyVal) && qtyVal > 0) {
          unitVal = qtyVal;
        } else if (!isNaN(tripVal) && tripVal > 0) {
          unitVal = tripVal;
        }
      } else {
        if (!isNaN(qtyVal) && qtyVal > 0) {
          unitVal = qtyVal;
        }
      }

      let costVal = parseFloat(row[costFieldName] || '0');
      
      // Fallback lookup: If costVal is 0 or empty, look up the selected material's preset price
      if (!costVal || costVal === 0) {
        const matType = getRowValue(row, ['materialtype', 'materialstype', 'material', 'materials']) || '';
        const matchedMaterial = materials.find(m => normalizeKey(m.name) === normalizeKey(matType));
        if (matchedMaterial) {
          costVal = matchedMaterial.price_per_unit;
          row[costFieldName] = String(costVal);
        }
      }
      
      // Find calculation / total field in the row case-insensitively
      const calFieldName = Object.keys(row).find(k => {
        const norm = normalizeKey(k);
        return norm.startsWith('cal') || norm.includes('total') || norm.includes('amount');
      });
      
      if (calFieldName) {
        if (!isNaN(unitVal) && !isNaN(costVal)) {
          row[calFieldName] = String(unitVal * costVal);
        }
      }

      updated[rowIndex] = row;
      return updated;
    });
  };

  const addRow = () => {
    const newRow = {};
    tableFields.forEach(f => { 
      if (f.type === 'date' || f.type === 'datetime' || f.type === 'time') {
        newRow[f.name] = new Date().toISOString();
      } else {
        newRow[f.name] = ''; 
      }
    });
    
    // Auto-increment Sno
    const snoField = tableFields.find(f => {
      const norm = normalizeKey(f.name);
      return norm === 'sno' || norm === 'slno';
    });
    if (snoField) {
      newRow[snoField.name] = String(rowData.length + 1);
    }
    
    setRowData(prev => [...prev, newRow]);
  };

  const removeRow = (index) => {
    if (rowData.length <= 1) {
      Alert.alert('Cannot Remove', 'At least one row is required.');
      return;
    }
    setRowData(prev => prev.filter((_, i) => i !== index));
  };

  const calculateTotal = () => {
    let subTotal = 0;
    
    // Check if we have Cal fields first (most accurate for this user)
    const calFieldName = tableFields.find(f => {
      const norm = normalizeKey(f.name);
      return norm.startsWith('cal') || norm.includes('total') || norm.includes('amount');
    })?.name;
    
    if (calFieldName) {
      rowData.forEach(row => {
        const val = parseFloat(row[calFieldName]);
        if (!isNaN(val)) subTotal += val;
      });
    } else {
      // Fallback to last numeric field
      const numericFields = tableFields.filter(f => f.type === 'numeric');
      const valueField = numericFields.length > 0 ? numericFields[numericFields.length - 1] : null;
      
      if (valueField) {
        rowData.forEach(row => {
          const val = parseFloat(row[valueField.name]);
          if (!isNaN(val)) subTotal += val;
        });
      }
    }

    // Add balance amount
    const balance = parseFloat(getRowValue(headerData, ['balance', 'balanceamount', 'unclearedbalance']) || '0');
    let total = subTotal;
    if (!isNaN(balance)) {
      total += balance;
    }

    // Add taxes
    if (calcSettings.includeTax) {
      const taxRate = parseFloat(String(calcSettings.taxRate || '18'));
      if (!isNaN(taxRate) && taxRate > 0) {
        const taxAmount = subTotal * (taxRate / 100);
        total += taxAmount;
      }
    }
    
    return total;
  };

  // Sync the grand total to the <Total> header field safely without render side-effects
  const balanceVal = getRowValue(headerData, ['balance', 'balanceamount', 'unclearedbalance']);
  useEffect(() => {
    const total = calculateTotal();
    const totalHeaderField = headerFields.find(f => normalizeKey(f.name) === 'total')?.name;
    if (totalHeaderField && headerData[totalHeaderField] !== String(total)) {
      setHeaderData(prev => ({ ...prev, [totalHeaderField]: String(total) }));
    }
  }, [rowData, balanceVal, headerFields]);

  const renderLivePreview = () => {
    const primaryThemeColor = template?.theme_color || '#0F2050';
    const selectedFont = template?.font_family || 'Arial';
    const selectedBorderStyle = template?.border_style || 'single';

    const getFontFamilyStyle = () => {
      if (selectedFont === 'Times New Roman') return Platform.OS === 'web' ? 'Times New Roman, Times, serif' : 'serif';
      if (selectedFont === 'Courier New') return Platform.OS === 'web' ? 'Courier New, Courier, monospace' : 'monospace';
      if (selectedFont === 'Georgia') return Platform.OS === 'web' ? 'Georgia, serif' : 'serif';
      return Platform.OS === 'web' ? 'Arial, sans-serif' : 'sans-serif';
    };

    const fontFamilyStyle = getFontFamilyStyle();

    const getBorderStyle = () => {
      if (selectedBorderStyle === 'none') return { borderWidth: 0 };
      if (selectedBorderStyle === 'double') return { borderWidth: 3, borderStyle: 'double', borderColor: primaryThemeColor };
      if (selectedBorderStyle === 'fine') return { borderWidth: 1, borderColor: '#DDDDDD' };
      return { borderWidth: 1, borderColor: primaryThemeColor };
    };

    const getCellBorderStyle = () => {
      if (selectedBorderStyle === 'none') return { borderWidth: 0, borderBottomWidth: 1, borderBottomColor: '#EEEEEE' };
      if (selectedBorderStyle === 'double') return { borderWidth: 1, borderColor: primaryThemeColor }; // fine inside double table
      if (selectedBorderStyle === 'fine') return { borderWidth: 1, borderColor: '#DDDDDD' };
      return { borderWidth: 1, borderColor: primaryThemeColor };
    };

    const tableBorder = getBorderStyle();
    const cellBorder = getCellBorderStyle();
    const tableHeaderBg = selectedBorderStyle === 'none' ? 'transparent' : '#F8FAFC';

    const companyName = getRowValue(headerData, ['shopname', 'companyname']) || companyProfile.name || template.name;
    
    let companyAddress = getRowValue(headerData, ['shoplocation', 'shopaddress', 'address']);
    if (!companyAddress && companyProfile) {
      companyAddress = [companyProfile.address, companyProfile.location].filter(p => p && p.trim() !== '').join(', ');
    }
    if (!companyAddress) companyAddress = '';

    const companyPhone = getRowValue(headerData, ['shopnumber', 'shopphone', 'phone']) || companyProfile.phone || '';
    const billNumber = getRowValue(headerData, ['bn', 'billnumber']) || '';
    const partyName = getRowValue(headerData, ['partyname', 'customername', 'clientname']) || '';
    
    // Format display date
    let displayDate = '';
    const rawBillDate = getRowValue(headerData, ['billdate', 'date']);
    if (rawBillDate) {
      try {
        const dObj = new Date(rawBillDate);
        if (!isNaN(dObj.getTime())) {
          displayDate = dObj.toLocaleDateString('en-IN', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
          });
        } else {
          displayDate = String(rawBillDate);
        }
      } catch (e) {
        displayDate = String(rawBillDate);
      }
    }
    
    const deliveryLoc = getRowValue(headerData, ['deliveryloc', 'place', 'location']) || '';
    const balanceAmount = parseFloat(getRowValue(headerData, ['balance', 'balanceamount', 'unclearedbalance']) || '0') || 0;
    
    // Sum of row amounts (Subtotal before taxes and balance)
    let subTotal = 0;
    const calFieldName = tableFields.find(f => {
      const norm = normalizeKey(f.name);
      return norm.startsWith('cal') || norm.includes('total') || norm.includes('amount');
    })?.name;
    
    if (calFieldName) {
      rowData.forEach(row => {
        const val = parseFloat(row[calFieldName]);
        if (!isNaN(val)) subTotal += val;
      });
    } else {
      const numericFields = tableFields.filter(f => f.type === 'numeric');
      const valueField = numericFields.length > 0 ? numericFields[numericFields.length - 1] : null;
      if (valueField) {
        rowData.forEach(row => {
          const val = parseFloat(row[valueField.name]);
          if (!isNaN(val)) subTotal += val;
        });
      }
    }

    let taxAmount = 0;
    if (calcSettings.includeTax) {
      const taxRate = parseFloat(String(calcSettings.taxRate || '18'));
      if (!isNaN(taxRate) && taxRate > 0) {
        taxAmount = subTotal * (taxRate / 100);
      }
    }
    
    const grandTotal = subTotal + balanceAmount + taxAmount;

    // Filter out standard fields to get custom header fields
    const normalizedStandardFields = ['bn', 'shopname', 'shoplocation', 'shopnumber', 'partyname', 'billdate', 'deliveryloc', 'total', 'balance', 'balanceamount', 'unclearedbalance'];
    const customHeaderFields = headerFields.filter(f => !normalizedStandardFields.includes(normalizeKey(f.name)));

    // Filter out price/rate field from the table columns in the preview
    const activeTableFields = tableFields.filter(f => {
      const norm = normalizeKey(f.name);
      return !(
        norm === 'materialtypecost' || 
        norm.includes('priceperunit') || 
        norm.includes('priceper') || 
        norm.includes('rate') || 
        norm.includes('cost') || 
        norm.includes('perunit') || 
        norm.includes('unitprice') || 
        norm.includes('unitrate') || 
        norm.includes('unitcost') || 
        norm.includes('priceunit') || 
        norm.includes('rateunit') || 
        norm.includes('costunit') || 
        (norm.includes('price') && !norm.includes('total') && !norm.includes('subtotal') && !norm.includes('grand'))
      );
    });

    // Pad rowData to at least 4 rows for a formal bill look
    const displayRows = [...rowData];
    while (displayRows.length < 4) {
      displayRows.push({});
    }

    return (
      <Card style={styles.previewContainer}>
        {/* Title Badge */}
        <View style={styles.previewBadgeHeader}>
          <Ionicons name="eye-outline" size={16} color={Colors.accent} />
          <Text style={styles.previewBadgeText}>Live Bill Preview (A4 Mockup)</Text>
        </View>

        {/* Paper Sheet */}
        <View style={[styles.paperSheet, { borderColor: primaryThemeColor }]}>
          {/* Shop Details Header Block */}
          <View style={styles.canvasShopHeader}>
            {/* Top Row with BN, ShopName, ShopNumber */}
            <View style={styles.canvasShopHeaderTop}>
              {/* Left: BN */}
              <View style={styles.canvasBnContainer}>
                <Text style={[styles.canvasBnText, { fontFamily: fontFamilyStyle }]}>
                  {billNumber || <Text style={styles.canvasMissingFieldPlaceholder}>&lt;BN&gt;</Text>}
                </Text>
              </View>

              {/* Center: Shop Name */}
              <View style={styles.canvasShopNameContainer}>
                <Text style={[styles.canvasShopNameText, { color: primaryThemeColor, fontFamily: fontFamilyStyle }]}>
                  {companyName || <Text style={styles.canvasMissingFieldPlaceholder}>&lt;ShopName&gt;</Text>}
                </Text>
              </View>

              {/* Right: Shop Number */}
              <View style={styles.canvasShopNumContainer}>
                <Text style={[styles.canvasShopNumText, { fontFamily: fontFamilyStyle }]}>
                  {companyPhone ? `📞 ${companyPhone}` : <Text style={styles.canvasMissingFieldPlaceholder}>📞 &lt;ShopNumber&gt;</Text>}
                </Text>
              </View>
            </View>

            {/* Sub-header Center: Shop Location */}
            <View style={styles.canvasShopLocContainer}>
              <Text style={[styles.canvasShopLocText, { fontFamily: fontFamilyStyle }]}>
                {companyAddress || <Text style={styles.canvasMissingFieldPlaceholder}>&lt;ShopLocation&gt;</Text>}
              </Text>
            </View>
          </View>

          {/* Horizontal Divider Line */}
          <View style={[styles.canvasDividerLine, { backgroundColor: primaryThemeColor }]} />

          {/* Customer / Party details grid */}
          <View style={styles.canvasCustomerDetailsGrid}>
            {/* Left side: Party Name */}
            <View style={styles.canvasPartyNameContainer}>
              <Text style={[styles.canvasPartyLabel, { fontFamily: fontFamilyStyle }]}>M/s:</Text>
              <View style={[styles.canvasSolidUnderline, { borderBottomColor: primaryThemeColor }]}>
                <Text style={[styles.canvasPlaceholderVal, { fontFamily: fontFamilyStyle, fontWeight: 'bold', color: '#000' }]}>
                  {partyName || <Text style={styles.canvasMissingFieldPlaceholder}>&lt;PartyName&gt;</Text>}
                </Text>
              </View>
            </View>

            {/* Right side: Date and Place */}
            <View style={styles.canvasDatePlaceContainer}>
              <View style={styles.canvasDateRow}>
                <Text style={[styles.canvasPartyLabel, { fontFamily: fontFamilyStyle }]}>Date:</Text>
                <View style={[styles.canvasSolidUnderlineShort, { borderBottomColor: primaryThemeColor }]}>
                  <Text style={[styles.canvasPlaceholderVal, { fontFamily: fontFamilyStyle, fontWeight: 'bold', color: '#000' }]}>
                    {displayDate || <Text style={styles.canvasMissingFieldPlaceholder}>&lt;BillDate&gt;</Text>}
                  </Text>
                </View>
              </View>

              <View style={[styles.canvasDateRow, { marginTop: 6 }]}>
                <Text style={[styles.canvasPartyLabel, { fontFamily: fontFamilyStyle }]}>Place:</Text>
                <View style={[styles.canvasSolidUnderlineShort, { borderBottomColor: primaryThemeColor }]}>
                  <Text style={[styles.canvasPlaceholderVal, { fontFamily: fontFamilyStyle, fontWeight: 'bold', color: '#000' }]}>
                    {deliveryLoc || <Text style={styles.canvasMissingFieldPlaceholder}>&lt;DeliveryLoc&gt;</Text>}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* Custom Header Fields Grid */}
          {customHeaderFields.length > 0 && (
            <View style={[styles.paperCustomFieldsGrid, { borderColor: primaryThemeColor }]}>
              {customHeaderFields.map(f => {
                let val = headerData[f.name] || '';
                if (f.type === 'date' || f.type === 'datetime') {
                  try {
                    const d = new Date(val);
                    if (!isNaN(d.getTime())) {
                      val = d.toLocaleDateString('en-IN');
                    }
                  } catch (e) {}
                }
                return (
                  <View key={f.name} style={styles.paperCustomFieldItem}>
                    <Text style={[styles.paperCustomFieldLabel, { fontFamily: fontFamilyStyle }]}>{f.label}:</Text>
                    <Text style={[styles.paperCustomFieldValue, { fontFamily: fontFamilyStyle }]}>{val}</Text>
                  </View>
                );
              })}
            </View>
          )}

          {/* Data Table */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ width: '100%' }}>
            <View style={{ minWidth: 550 }}>
              <View style={[styles.paperTable, tableBorder]}>
                {/* Table Header */}
                <View style={[styles.paperTableHeader, { borderBottomColor: selectedBorderStyle === 'none' ? 'transparent' : primaryThemeColor, borderBottomWidth: 1, backgroundColor: tableHeaderBg }]}>
                  {activeTableFields.map(f => {
                    const norm = normalizeKey(f.name);
                    const isNumeric = f.type === 'numeric' || norm.startsWith('cal') || norm.includes('total') || norm.includes('amount') || f.isVirtual;
                    return (
                      <View key={f.name} style={[styles.paperTableHeaderCell, { borderRightColor: selectedBorderStyle === 'none' ? 'transparent' : primaryThemeColor, borderRightWidth: selectedBorderStyle === 'none' ? 0 : 1 }, isNumeric && { alignItems: 'flex-end', justifyContent: 'center' }]}>
                        <Text style={[styles.paperTableHeaderText, { color: primaryThemeColor, fontFamily: fontFamilyStyle }]}>{f.label || f.name}</Text>
                      </View>
                    );
                  })}
                </View>

                {/* Table Rows */}
                {displayRows.map((row, idx) => (
                  <View key={idx} style={[styles.paperTableRow, { borderBottomColor: selectedBorderStyle === 'none' ? '#EEEEEE' : primaryThemeColor }]}>
                    {activeTableFields.map(field => {
                      const val = row[field.name] || '';
                      const norm = normalizeKey(field.name);
                      const isNumeric = field.type === 'numeric' || norm.startsWith('cal') || norm.includes('total') || norm.includes('amount') || field.isVirtual;
                      
                      let displayVal = val;
                      if ((field.type === 'date' || field.type === 'time' || field.type === 'datetime') && val) {
                        try {
                          const dObj = new Date(val);
                          if (!isNaN(dObj.getTime())) {
                            const day = String(dObj.getDate()).padStart(2, '0');
                            const month = String(dObj.getMonth() + 1).padStart(2, '0');
                            const year = String(dObj.getFullYear()).slice(-2);
                            const dateStr = `${day}-${month}-${year}`; // e.g. 23-05-26
                            
                            let hours = dObj.getHours();
                            const ampm = hours >= 12 ? 'PM' : 'AM';
                            hours = hours % 12;
                            hours = hours ? hours : 12;
                            const min = String(dObj.getMinutes()).padStart(2, '0');
                            const timeStr = `${String(hours).padStart(2, '0')}:${min} ${ampm}`;
                            
                            const columnLabelNorm = field.label ? field.label.toLowerCase() : '';
                            
                            const showTime = calcSettings.showTimeInTable;
                            if (field.type === 'date' || columnLabelNorm === 'date' || columnLabelNorm.includes('date')) {
                              displayVal = showTime ? `${dateStr} ${timeStr}` : dateStr;
                            } else if (field.type === 'time') {
                              displayVal = timeStr;
                            } else {
                              displayVal = showTime ? `${dateStr}\n${timeStr}` : dateStr;
                            }
                          }
                        } catch (e) {}
                      } else if (isNumeric && val) {
                        const num = parseFloat(val);
                        if (!isNaN(num)) {
                          displayVal = formatIndianNumber(num);
                        }
                      }

                      return (
                        <View key={field.name} style={[styles.paperTableCell, { borderRightColor: selectedBorderStyle === 'none' ? 'transparent' : primaryThemeColor, borderRightWidth: selectedBorderStyle === 'none' ? 0 : 1 }, isNumeric && { alignItems: 'flex-end' }]}>
                          <Text style={[styles.paperTableCellText, { fontFamily: fontFamilyStyle }]}>{displayVal}</Text>
                        </View>
                      );
                    })}
                  </View>
                ))}
              </View>
            </View>
          </ScrollView>

          {/* Footer Totals */}
          <View style={[styles.paperTotalsContainer, { borderColor: primaryThemeColor }]}>
            {calcSettings.includeTax && (
              <View style={styles.paperTotalRow}>
                <Text style={[styles.paperTotalLabel, { fontFamily: fontFamilyStyle }]}>Subtotal:</Text>
                <Text style={[styles.paperTotalValue, { fontFamily: fontFamilyStyle }]}>₹ {formatIndianNumber(subTotal)}</Text>
              </View>
            )}
            {calcSettings.includeTax && (
              <View style={styles.paperTotalRow}>
                <Text style={[styles.paperTotalLabel, { fontFamily: fontFamilyStyle }]}>GST ({calcSettings.taxRate}%):</Text>
                <Text style={[styles.paperTotalValue, { fontFamily: fontFamilyStyle }]}>₹ {formatIndianNumber(taxAmount)}</Text>
              </View>
            )}
            {balanceAmount > 0 && (
              <>
                {!calcSettings.includeTax && (
                  <View style={styles.paperTotalRow}>
                    <Text style={[styles.paperTotalLabel, { fontFamily: fontFamilyStyle }]}>Subtotal:</Text>
                    <Text style={[styles.paperTotalValue, { fontFamily: fontFamilyStyle }]}>₹ {formatIndianNumber(subTotal)}</Text>
                  </View>
                )}
                <View style={styles.paperTotalRow}>
                  <Text style={[styles.paperTotalLabel, { fontFamily: fontFamilyStyle }]}>Uncleared Balance:</Text>
                  <Text style={[styles.paperTotalValue, { fontFamily: fontFamilyStyle }]}>₹ {formatIndianNumber(balanceAmount)}</Text>
                </View>
              </>
            )}
            <View style={[styles.paperTotalRow, { borderTopWidth: (balanceAmount > 0 || calcSettings.includeTax) ? 1 : 0, borderTopColor: primaryThemeColor, paddingTop: 4 }]}>
              <Text style={[styles.paperTotalLabel, { fontSize: 15, fontWeight: '900', fontFamily: fontFamilyStyle }]}>Total:</Text>
              <Text style={[styles.paperTotalValue, { fontSize: 16, fontWeight: '900', fontFamily: fontFamilyStyle }]}>₹ {formatIndianNumber(grandTotal)}</Text>
            </View>
          </View>

          {/* Signature Block */}
          <View style={styles.paperSignatureRow}>
            <Text style={[styles.paperSignatureText, { fontFamily: fontFamilyStyle }]}>{"Receiver's Signature:"}</Text>
            <View style={[styles.paperSignatureLine, { borderBottomColor: primaryThemeColor }]} />
          </View>
        </View>
      </Card>
    );
  };

  const openMaterialPicker = (rowIndex, fieldName) => {
    setActiveRowIdx(rowIndex);
    setActiveFieldKey(fieldName);
    setShowCustomMaterialForm(false);
    setCustomMaterialInput('');
    setMaterialModalVisible(true);
  };

  const selectMaterial = (materialName) => {
    updateRowField(activeRowIdx, activeFieldKey, materialName);
    setMaterialModalVisible(false);
  };

  const openCustomerPicker = (fieldName) => {
    setActiveCustomerField(fieldName);
    setCustomerSearchQuery('');
    setCustomerModalVisible(true);
  };

  const selectCustomer = (c) => {
    if (activeCustomerField) {
      updateHeaderField(activeCustomerField, c.name);
    }
    setCustomerPhone(c.phone || '');
    setCustomerAddress(c.address || '');
    setCustomerModalVisible(false);
  };

  const handleGeneratePDF = async () => {
    // Open print window synchronously on web to bypass Chrome popup blocker
    let printWindow = null;
    if (Platform.OS === 'web') {
      printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.open();
        printWindow.document.write('<html><head><title>Generating PDF...</title><style>body { font-family: sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; color: #666; }</style></head><body><div><h2>Generating formal A4 invoice PDF...</h2><p>Please wait a moment.</p></div></body></html>');
        printWindow.document.close();
      }
    }

    setGenerating(true);
    try {
      const totalAmount = calculateTotal();
      
      const mergedHeaderData = {
        ...headerData,
        calc_multiply_trip: calcSettings.multiplyTrip ? 'true' : 'false',
        calc_include_tax: calcSettings.includeTax ? 'true' : 'false',
        calc_tax_rate: String(calcSettings.taxRate),
        calc_show_time_in_table: calcSettings.showTimeInTable ? 'true' : 'false',
      };
      const result = await generatePDF({
        companyProfile,
        headerData: mergedHeaderData,
        rowData,
        headerFields,
        tableFields,
        templateName: template.name,
        totalAmount,
        printWindow,
        themeColor: template?.theme_color,
        fontFamily: template?.font_family,
        borderStyle: template?.border_style,
      });

      if (result.success) {
        if (Platform.OS === 'web') return; // Print handled directly in popup on Web
        
        // Save PDF permanently
        const billNumber = headerData.BN || `BF-${Date.now().toString(36).toUpperCase()}`;
        const permanentUri = await savePDFPermanently(result.uri, billNumber);
        
        // Share the PDF
        await sharePDF(permanentUri);
      } else {
        if (printWindow) printWindow.close();
        Alert.alert('Error', 'Failed to generate PDF: ' + (result.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('PDF generation error:', error);
      if (printWindow) printWindow.close();
      Alert.alert('Error', 'Failed to generate PDF.');
    } finally {
      setGenerating(false);
    }
  };

  const handleSaveBill = async () => {
    // Open print window synchronously on web to bypass Chrome popup blocker
    let printWindow = null;
    if (Platform.OS === 'web') {
      printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.open();
        printWindow.document.write('<html><head><title>Saving & Generating PDF...</title><style>body { font-family: sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; color: #666; }</style></head><body><div><h2>Saving bill and generating PDF...</h2><p>Please wait a moment.</p></div></body></html>');
        printWindow.document.close();
      }
    }

    setSaving(true);
    try {
      const db = await getDatabase();
      const totalAmount = calculateTotal();
      const billNumber = headerData.BN || `BF-${Date.now().toString(36).toUpperCase()}`;
      
      // Find customer name from common field names case-insensitively
      const customerName = getRowValue(headerData, ['partyname', 'customername', 'clientname', 'name']) || '';

      // Auto-save/update customer in the Customer Directory
      if (customerName && customerName.trim() !== '') {
        const existing = customers.find(c => normalizeKey(c.name) === normalizeKey(customerName));
        const customerData = {
          name: customerName,
          phone: customerPhone || '',
          address: customerAddress || ''
        };
        if (existing) {
          if (existing.phone !== customerPhone || existing.address !== customerAddress) {
            await saveCustomer(db, { ...existing, ...customerData });
          }
        } else {
          await saveCustomer(db, customerData);
        }
        await loadCustomers();
      }

      // Prepare header data with customer phone/address to store in the DB record
      const headerDataToSave = {
        ...headerData,
        customer_phone: customerPhone,
        customer_address: customerAddress,
        calc_multiply_trip: calcSettings.multiplyTrip ? 'true' : 'false',
        calc_include_tax: calcSettings.includeTax ? 'true' : 'false',
        calc_tax_rate: String(calcSettings.taxRate),
        calc_show_time_in_table: calcSettings.showTimeInTable ? 'true' : 'false',
      };

      // Generate PDF (uses original headerData to ensure customer phone/address NEVER print on PDF)
      const pdfResult = await generatePDF({
        companyProfile,
        headerData: headerDataToSave,
        rowData,
        headerFields,
        tableFields,
        templateName: template.name,
        totalAmount,
        printWindow,
        themeColor: template?.theme_color,
        fontFamily: template?.font_family,
        borderStyle: template?.border_style,
      });

      let pdfUri = '';
      if (pdfResult.success && Platform.OS !== 'web') {
        pdfUri = await savePDFPermanently(pdfResult.uri, billNumber);
      }

      const billId = await saveBill(db, {
        template_id: parseInt(templateId),
        company_id: 1,
        bill_number: billNumber,
        customer_name: customerName,
        headerData: headerDataToSave,
        rowData,
        total_amount: totalAmount,
        pdf_uri: pdfUri,
      });

      Alert.alert(
        'Bill Saved',
        `Bill "${billNumber}" saved successfully.`,
        [
          {
            text: 'View Bill',
            onPress: () => router.replace(`/bill-preview/${billId}`),
          },
          {
            text: 'Create Another',
            onPress: async () => {
              try {
                // Reset form
                setCustomerPhone('');
                setCustomerAddress('');
                const db = await getDatabase();
                const nextBn = await getNextBillNumber(db);
                const hData = {};
                headerFields.forEach(f => { 
                  const norm = normalizeKey(f.name);
                  if (f.type === 'date' || f.type === 'datetime') {
                    hData[f.name] = new Date().toISOString();
                  } else if (norm === 'bn' || norm === 'billnumber' || norm === 'billno') {
                    hData[f.name] = nextBn;
                  } else if (companyProfile && (norm === 'shopname' || norm === 'companyname')) {
                    hData[f.name] = companyProfile.name || '';
                  } else if (companyProfile && (norm === 'shoplocation' || norm === 'shopaddress' || norm === 'address')) {
                    hData[f.name] = companyProfile.location || companyProfile.address || '';
                  } else if (companyProfile && (norm === 'shopnumber' || norm === 'shopphone' || norm === 'phone')) {
                    hData[f.name] = companyProfile.phone || '';
                  } else {
                    hData[f.name] = ''; 
                  }
                });
                setHeaderData(hData);
                const rowInit = {};
                tableFields.forEach(f => { 
                  if (f.type === 'date' || f.type === 'datetime' || f.type === 'time') {
                    rowInit[f.name] = new Date().toISOString();
                  } else {
                    rowInit[f.name] = ''; 
                  }
                });
                setRowData([{ ...rowInit }]);
              } catch (err) {
                console.error('Error resetting form:', err);
              }
            },
          },
        ],
      );
    } catch (error) {
      console.error('Save bill error:', error);
      if (printWindow) printWindow.close();
      Alert.alert('Error', 'Failed to save bill.');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAndShareWhatsAppPress = () => {
    // Find customer phone from state or pre-existing customer records to pre-populate
    setWhatsappPhone(customerPhone || '');
    setWhatsappModalVisible(true);
  };

  const confirmSaveAndShareWhatsApp = async () => {
    setWhatsappModalVisible(false);
    setSaving(true);
    setSharingWhatsApp(true);
    
    // Open the print and WhatsApp windows immediately in the user-initiated handler to bypass popup blockers!
    let printWindow = null;
    let waWindow = null;
    
    // Format WhatsApp number
    let formattedPhone = whatsappPhone.trim().replace(/[\s+-]/g, '');
    if (formattedPhone.length === 10) {
      formattedPhone = `91${formattedPhone}`; // Standard India country code
    }
    
    if (Platform.OS === 'web') {
      // 1. Open placeholder window for printing
      printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.open();
        printWindow.document.write('<html><head><title>Preparing Invoice PDF...</title><style>body { font-family: sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; color: #666; }</style></head><body><div><h2>Generating invoice PDF...</h2><p>Please wait a moment.</p></div></body></html>');
        printWindow.document.close();
      }
      
      // 2. Open placeholder window for WhatsApp Web
      waWindow = window.open('', '_blank');
      if (waWindow) {
        waWindow.document.open();
        waWindow.document.write('<html><head><title>Opening WhatsApp...</title><style>body { font-family: sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; color: #666; }</style></head><body><div><h2>Preparing WhatsApp chat...</h2><p>Please wait.</p></div></body></html>');
        waWindow.document.close();
      }
    }

    try {
      const db = await getDatabase();
      const totalAmount = calculateTotal();
      const billNumber = headerData.BN || `BF-${Date.now().toString(36).toUpperCase()}`;
      
      const customerName = getRowValue(headerData, ['partyname', 'customername', 'clientname', 'name']) || '';

      // Auto-save/update customer details in DB
      if (customerName && customerName.trim() !== '') {
        const existing = customers.find(c => normalizeKey(c.name) === normalizeKey(customerName));
        const customerData = {
          name: customerName,
          phone: whatsappPhone || '',
          address: customerAddress || ''
        };
        if (existing) {
          if (existing.phone !== whatsappPhone || existing.address !== customerAddress) {
            await saveCustomer(db, { ...existing, ...customerData });
          }
        } else {
          await saveCustomer(db, customerData);
        }
        await loadCustomers();
      }

      // Save confirmed number in header
      const headerDataToSave = {
        ...headerData,
        customer_phone: whatsappPhone,
        customer_address: customerAddress,
        calc_multiply_trip: calcSettings.multiplyTrip ? 'true' : 'false',
        calc_include_tax: calcSettings.includeTax ? 'true' : 'false',
        calc_tax_rate: String(calcSettings.taxRate),
        calc_show_time_in_table: calcSettings.showTimeInTable ? 'true' : 'false',
      };

      // Generate the PDF (this will write directly to our printWindow on Web!)
      const pdfResult = await generatePDF({
        companyProfile,
        headerData: headerDataToSave,
        rowData,
        headerFields,
        tableFields,
        templateName: template.name,
        totalAmount,
        printWindow, // pass the print window to draw the PDF
        themeColor: template?.theme_color,
        fontFamily: template?.font_family,
        borderStyle: template?.border_style,
      });

      let pdfUri = '';
      if (pdfResult.success && Platform.OS !== 'web') {
        pdfUri = await savePDFPermanently(pdfResult.uri, billNumber);
      }

      // Save bill record in DB
      await saveBill(db, {
        template_id: parseInt(templateId),
        company_id: 1,
        bill_number: billNumber,
        customer_name: customerName,
        headerData: headerDataToSave,
        rowData,
        total_amount: totalAmount,
        pdf_uri: pdfUri,
      });

      const shopNameStr = getRowValue(headerData, ['shopname', 'companyname']) || companyProfile.name || template.name;
      const messageText = `Dear Customer, here is your invoice (No: ${billNumber}) from ${shopNameStr}. Total Amount: Rs. ${formatIndianNumber(totalAmount)}. Thank you for your business!`;
      const encodedMsg = encodeURIComponent(messageText);

      // On Mobile (built Android/iOS app): Trigger native sharing of the PDF itself so the actual PDF gets sent!
      if (Platform.OS !== 'web' && pdfUri) {
        await sharePDF(pdfUri);
        
        // Also open WhatsApp chat message if phone is provided
        if (formattedPhone) {
          const waUrl = `whatsapp://send?phone=${formattedPhone}&text=${encodedMsg}`;
          try {
            const { Linking } = require('react-native');
            const supported = await Linking.canOpenURL(waUrl);
            if (supported) {
              setTimeout(() => {
                Linking.openURL(waUrl);
              }, 1200);
            }
          } catch (e) {
            console.error('Error opening WhatsApp chat:', e);
          }
        }
      } else {
        // On Web Browsers: Redirect our already open waWindow to WhatsApp Web!
        if (waWindow) {
          const webWaUrl = `https://wa.me/${formattedPhone || ''}?text=${encodedMsg}`;
          waWindow.location.href = webWaUrl;
        }
      }

      Alert.alert(
        'Success',
        `Bill "${billNumber}" saved and shared successfully.`,
        [
          {
            text: 'Create Another',
            onPress: async () => {
              try {
                setCustomerPhone('');
                setCustomerAddress('');
                const db = await getDatabase();
                const nextBn = await getNextBillNumber(db);
                const hData = {};
                headerFields.forEach(f => { 
                  const norm = normalizeKey(f.name);
                  if (f.type === 'date' || f.type === 'datetime') {
                    hData[f.name] = new Date().toISOString();
                  } else if (norm === 'bn' || norm === 'billnumber' || norm === 'billno') {
                    hData[f.name] = nextBn;
                  } else if (companyProfile && (norm === 'shopname' || norm === 'companyname')) {
                    hData[f.name] = companyProfile.name || '';
                  } else if (companyProfile && (norm === 'shoplocation' || norm === 'shopaddress' || norm === 'address')) {
                    hData[f.name] = companyProfile.location || companyProfile.address || '';
                  } else if (companyProfile && (norm === 'shopnumber' || norm === 'shopphone' || norm === 'phone')) {
                    hData[f.name] = companyProfile.phone || '';
                  } else {
                    hData[f.name] = ''; 
                  }
                });
                setHeaderData(hData);
                const rowInit = {};
                tableFields.forEach(f => { 
                  if (f.type === 'date' || f.type === 'datetime' || f.type === 'time') {
                    rowInit[f.name] = new Date().toISOString();
                  } else {
                    rowInit[f.name] = ''; 
                  }
                });
                setRowData([{ ...rowInit }]);
              } catch (err) {
                console.error('Error resetting form:', err);
              }
            }
          },
          { text: 'OK' }
        ]
      );
    } catch (error) {
      console.error('Save & Share WhatsApp Error:', error);
      if (printWindow) printWindow.close();
      Alert.alert('Error', 'Failed to save and share bill.');
    } finally {
      setSaving(false);
      setSharingWhatsApp(false);
    }
  };

  const renderField = (field, value, onChange) => {
    const isPartyName = ['partyname', 'customername', 'clientname', 'name'].includes(normalizeKey(field.name));

    if (isPartyName) {
      return (
        <View key={field.name} style={styles.partyNameContainer}>
          <View style={styles.partyNameHeaderRow}>
            <Text style={styles.dropdownLabel}>{field.label}</Text>
            <TouchableOpacity
              style={styles.partyNameSelectButton}
              onPress={() => openCustomerPicker(field.name)}
              activeOpacity={0.7}
            >
              <Ionicons name="people-outline" size={15} color={Colors.primary} style={{ marginRight: 4 }} />
              <Text style={styles.partyNameSelectButtonText}>Select Existing</Text>
            </TouchableOpacity>
          </View>
          
          <Input
            value={value || ''}
            onChangeText={(val) => {
              onChange(val);
              const existing = customers.find(c => normalizeKey(c.name) === normalizeKey(val));
              if (existing) {
                setCustomerPhone(existing.phone || '');
                setCustomerAddress(existing.address || '');
              }
            }}
            placeholder={`Enter ${field.label.toLowerCase()} manually or select`}
            icon="person-outline"
          />

          <View style={styles.customerFieldsGroup}>
            <View style={styles.customerHalfField}>
              <Input
                label="Customer Phone (Optional)"
                value={customerPhone}
                onChangeText={setCustomerPhone}
                placeholder="Won't show on PDF"
                keyboardType="phone-pad"
                icon="call-outline"
              />
            </View>
            <View style={styles.customerHalfField}>
              <Input
                label="Resident Address (Optional)"
                value={customerAddress}
                onChangeText={setCustomerAddress}
                placeholder="Won't show on PDF"
                icon="home-outline"
              />
            </View>
          </View>
        </View>
      );
    }

    if (field.type === 'date') {
      return (
        <DateTimePickerInput
          key={field.name}
          label={field.label}
          value={value ? new Date(value) : null}
          onChange={(date) => onChange(date.toISOString())}
          mode="date"
        />
      );
    }
    if (field.type === 'time') {
      return (
        <DateTimePickerInput
          key={field.name}
          label={field.label}
          value={value ? new Date(value) : null}
          onChange={(date) => onChange(date.toISOString())}
          mode="time"
        />
      );
    }
    if (field.type === 'datetime') {
      return (
        <DateTimePickerInput
          key={field.name}
          label={field.label}
          value={value ? new Date(value) : null}
          onChange={(date) => onChange(date.toISOString())}
          mode="datetime"
        />
      );
    }

    return (
      <Input
        key={field.name}
        label={field.label}
        value={value || ''}
        onChangeText={onChange}
        placeholder={`Enter ${field.label.toLowerCase()}`}
        keyboardType={getKeyboardTypeForField(field.type)}
      />
    );
  };

  if (!template) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.centered}>
          <Text style={styles.loadingText}>Loading template...</Text>
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
          <Text style={styles.headerTitle} numberOfLines={1}>New Bill</Text>
          <Text style={styles.headerSub}>{template.name}</Text>
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
          {/* Header Fields Section */}
          {headerFields.length > 0 && (
            <Card style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <View style={[styles.sectionIconCircle, { backgroundColor: '#EBF5FB' }]}>
                  <Ionicons name="document-text-outline" size={18} color={Colors.primary} />
                </View>
                <Text style={styles.sectionTitle}>Bill Details</Text>
              </View>

              {headerFields.map(field =>
                renderField(
                  field,
                  headerData[field.name],
                  (val) => updateHeaderField(field.name, val)
                )
              )}
            </Card>
          )}

          {/* Table Fields Section */}
          {tableFields.length > 0 && (
            <Card style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <View style={[styles.sectionIconCircle, { backgroundColor: '#FFF3CD' }]}>
                  <Ionicons name="grid-outline" size={18} color={Colors.warning} />
                </View>
                <Text style={styles.sectionTitle}>Line Items</Text>
                <Text style={styles.rowCount}>{rowData.length} row(s)</Text>
              </View>

              {rowData.map((row, rowIndex) => (
                <View key={rowIndex} style={styles.rowCard}>
                  <View style={styles.rowHeader}>
                    <Text style={styles.rowLabel}>Row {rowIndex + 1}</Text>
                    {rowData.length > 1 && (
                      <TouchableOpacity
                        onPress={() => removeRow(rowIndex)}
                        style={styles.removeRowBtn}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      >
                        <Ionicons name="close-circle" size={20} color={Colors.danger} />
                      </TouchableOpacity>
                    )}
                  </View>

                  {/* Compact row fields */}
                  <View style={styles.rowFields}>
                    {tableFields.map(field => {
                      const isMaterialTypeField = ['materialtype', 'materialstype', 'material', 'materials'].includes(normalizeKey(field.name));
                      
                      return (
                        <View
                          key={field.name}
                          style={[
                            styles.rowFieldWrap,
                            tableFields.length <= 3 && styles.rowFieldHalf,
                            tableFields.length > 3 && styles.rowFieldThird,
                          ]}
                        >
                          {isMaterialTypeField ? (
                            <View style={styles.dropdownWrap}>
                              <Text style={styles.dropdownLabel}>{field.label}</Text>
                              <TouchableOpacity
                                style={styles.dropdownButton}
                                onPress={() => openMaterialPicker(rowIndex, field.name)}
                                activeOpacity={0.7}
                              >
                                <Text
                                  style={[styles.dropdownText, !row[field.name] && styles.placeholder]}
                                  numberOfLines={1}
                                  ellipsizeMode="tail"
                                >
                                  {row[field.name] || 'Select...'}
                                </Text>
                                <Ionicons name="chevron-down" size={14} color={Colors.textTertiary} style={{ marginLeft: 4 }} />
                              </TouchableOpacity>
                            </View>
                          ) : (field.type === 'date' || field.type === 'time' || field.type === 'datetime') ? (
                            <DateTimePickerInput
                              label={field.label}
                              value={row[field.name] ? new Date(row[field.name]) : null}
                              onChange={(date) => updateRowField(rowIndex, field.name, date.toISOString())}
                              mode={field.type}
                            />
                          ) : (
                            <Input
                              label={field.label}
                              value={row[field.name] || ''}
                              onChangeText={(val) => updateRowField(rowIndex, field.name, val)}
                              placeholder={field.label}
                              keyboardType={getKeyboardTypeForField(field.type)}
                            />
                          )}
                        </View>
                      );
                    })}
                  </View>
                </View>
              ))}

              <TouchableOpacity onPress={addRow} style={styles.addRowBtn}>
                <Ionicons name="add-circle-outline" size={20} color={Colors.primary} />
                <Text style={styles.addRowText}>Add Row</Text>
              </TouchableOpacity>
            </Card>
          )}

          {/* Balance Amount Section */}
          <Card style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionIconCircle, { backgroundColor: '#E8F5E9' }]}>
                <Ionicons name="cash-outline" size={18} color={Colors.success} />
              </View>
              <Text style={styles.sectionTitle}>Additional Settings</Text>
            </View>

            <Input
              label="Balance Amount (Rs.)"
              value={headerData.Balance || ''}
              onChangeText={(val) => updateHeaderField('Balance', val)}
              placeholder="Enter balance amount if any"
              keyboardType="numeric"
            />
          </Card>

          {/* Calculation & Display Settings Section */}
          <Card style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionIconCircle, { backgroundColor: '#EEF0FE' }]}>
                <Ionicons name="settings-outline" size={18} color={Colors.accent} />
              </View>
              <Text style={styles.sectionTitle}>Calculation & Display Settings</Text>
            </View>

            {/* Multiply Trip Row */}
            <View style={styles.settingRow}>
              <View style={styles.settingTextContainer}>
                <Text style={styles.settingLabel}>Multiply Trip with Cost</Text>
                <Text style={styles.settingDesc}>
                  Multiply Trip count by Units and Price for row amount.
                </Text>
              </View>
              <Switch
                value={calcSettings.multiplyTrip}
                onValueChange={(val) => {
                  const newSettings = { ...calcSettings, multiplyTrip: val };
                  setCalcSettings(newSettings);
                  recalculateAllRows(newSettings);
                }}
                trackColor={{ false: Colors.border, true: Colors.accent }}
                thumbColor={calcSettings.multiplyTrip ? '#fff' : '#f4f3f4'}
              />
            </View>

            <View style={styles.settingDivider} />

            {/* Apply Tax Row */}
            <View style={styles.settingRow}>
              <View style={styles.settingTextContainer}>
                <Text style={styles.settingLabel}>Apply GST / Taxes</Text>
                <Text style={styles.settingDesc}>
                  Include GST billing tax to the subtotal of the invoice.
                </Text>
              </View>
              <Switch
                value={calcSettings.includeTax}
                onValueChange={(val) => {
                  setCalcSettings(prev => ({ ...prev, includeTax: val }));
                }}
                trackColor={{ false: Colors.border, true: Colors.accent }}
                thumbColor={calcSettings.includeTax ? '#fff' : '#f4f3f4'}
              />
            </View>

            {calcSettings.includeTax && (
              <View style={styles.taxInputContainer}>
                <Input
                  label="GST / Tax Rate (%)"
                  value={String(calcSettings.taxRate)}
                  onChangeText={(val) => {
                    const parsed = parseFloat(val);
                    setCalcSettings(prev => ({ ...prev, taxRate: isNaN(parsed) ? 0 : parsed }));
                  }}
                  placeholder="e.g. 18"
                  keyboardType="numeric"
                  icon="percent-outline"
                />
              </View>
            )}

            <View style={styles.settingDivider} />

            {/* Show Time in Table Date Columns */}
            <View style={styles.settingRow}>
              <View style={styles.settingTextContainer}>
                <Text style={styles.settingLabel}>Show Time in Date Columns</Text>
                <Text style={styles.settingDesc}>
                  Display both date and time inside table date cells.
                </Text>
              </View>
              <Switch
                value={calcSettings.showTimeInTable}
                onValueChange={(val) => {
                  setCalcSettings(prev => ({ ...prev, showTimeInTable: val }));
                }}
                trackColor={{ false: Colors.border, true: Colors.accent }}
                thumbColor={calcSettings.showTimeInTable ? '#fff' : '#f4f3f4'}
              />
            </View>
          </Card>

          {/* Total */}
          {tableFields.some(f => f.type === 'numeric') && (
            <Card style={styles.totalCard}>
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Estimated Total</Text>
                <Text style={styles.totalValue}>Rs. {formatIndianNumber(calculateTotal())}</Text>
              </View>
            </Card>
          )}

          {/* Live Bill Preview Mockup */}
          {renderLivePreview()}

          {/* Action Buttons */}
          <View style={styles.actionsContainer}>
            <Button
              title="Save Bill"
              onPress={handleSaveBill}
              loading={saving && !sharingWhatsApp}
              variant="primary"
              fullWidth
              size="lg"
              icon="save-outline"
              style={styles.actionBtn}
            />
            <Button
              title="Save & Share on WhatsApp"
              onPress={handleSaveAndShareWhatsAppPress}
              loading={saving && sharingWhatsApp}
              variant="success"
              fullWidth
              size="lg"
              icon="logo-whatsapp"
              style={styles.actionBtn}
            />
            <Button
              title="Generate PDF"
              onPress={handleGeneratePDF}
              loading={generating}
              variant="accent"
              fullWidth
              size="lg"
              icon="document-outline"
              style={styles.actionBtn}
            />
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Materials Selector Dropdown Modal */}
      <Modal
        visible={materialModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setMaterialModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Material</Text>
              <TouchableOpacity onPress={() => setMaterialModalVisible(false)} style={styles.closeBtn}>
                <Ionicons name="close" size={24} color={Colors.text} />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.modalList} showsVerticalScrollIndicator={false}>
              {materials.map((m) => (
                <TouchableOpacity
                  key={m.id}
                  style={styles.modalItem}
                  onPress={() => selectMaterial(m.name)}
                >
                  <View style={styles.modalItemIconCircle}>
                    <Ionicons name="cube-outline" size={18} color={Colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.modalItemText}>{m.name}</Text>
                    <Text style={styles.modalItemSub}>Rs. {m.price_per_unit} / {m.unit_type || 'unit'}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={Colors.textTertiary} />
                </TouchableOpacity>
              ))}
              
              {/* Custom Material Option */}
              {!showCustomMaterialForm ? (
                <TouchableOpacity
                  style={[styles.modalItem, { borderBottomWidth: 0, marginTop: 10 }]}
                  onPress={() => setShowCustomMaterialForm(true)}
                >
                  <View style={[styles.modalItemIconCircle, { backgroundColor: '#E8F5E9' }]}>
                    <Ionicons name="create" size={18} color={Colors.success} />
                  </View>
                  <Text style={[styles.modalItemText, { color: Colors.success, fontWeight: '600' }]}>
                    Enter Custom Material...
                  </Text>
                </TouchableOpacity>
              ) : (
                <View style={styles.customForm}>
                  <Input
                    label="Custom Material Name"
                    value={customMaterialInput}
                    onChangeText={setCustomMaterialInput}
                    placeholder="Type material name"
                  />
                  <Button
                    title="Add & Select"
                    onPress={() => {
                      if (customMaterialInput.trim()) {
                        selectMaterial(customMaterialInput.trim());
                      } else {
                        Alert.alert('Required', 'Please enter a name');
                      }
                    }}
                    variant="success"
                    fullWidth
                  />
                </View>
              )}
              <View style={{ height: 40 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Customer Directory Selector Modal */}
      <Modal
        visible={customerModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setCustomerModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="people-outline" size={20} color={Colors.primary} />
                <Text style={styles.modalTitle}>Select Customer</Text>
              </View>
              <TouchableOpacity onPress={() => setCustomerModalVisible(false)} style={styles.closeBtn}>
                <Ionicons name="close" size={24} color={Colors.text} />
              </TouchableOpacity>
            </View>

            <View style={{ paddingHorizontal: 20, paddingBottom: 10 }}>
              <Input
                value={customerSearchQuery}
                onChangeText={setCustomerSearchQuery}
                placeholder="Search customers by name..."
                icon="search-outline"
              />
            </View>
            
            <ScrollView style={styles.modalList} showsVerticalScrollIndicator={false}>
              {customers.filter(c => 
                c.name.toLowerCase().includes(customerSearchQuery.toLowerCase())
              ).map((c) => (
                <TouchableOpacity
                  key={c.id}
                  style={styles.modalItem}
                  onPress={() => selectCustomer(c)}
                >
                  <View style={[styles.modalItemIconCircle, { backgroundColor: '#EBF5FB' }]}>
                    <Ionicons name="person-outline" size={18} color={Colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.modalItemText}>{c.name}</Text>
                    {c.phone ? (
                      <Text style={styles.modalItemSub}>📞 {c.phone}</Text>
                    ) : null}
                    {c.address ? (
                      <Text style={styles.modalItemSub} numberOfLines={1}>📍 {c.address}</Text>
                    ) : null}
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={Colors.textTertiary} />
                </TouchableOpacity>
              ))}

              {customers.filter(c => 
                c.name.toLowerCase().includes(customerSearchQuery.toLowerCase())
              ).length === 0 && (
                <View style={{ padding: 30, alignItems: 'center' }}>
                  <Ionicons name="people-outline" size={48} color={Colors.textTertiary} style={{ marginBottom: 10 }} />
                  <Text style={{ ...Typography.bodyMedium, color: Colors.textSecondary, textAlign: 'center' }}>
                    No customers found. Type a name in the form manually to automatically save them!
                  </Text>
                </View>
              )}
              <View style={{ height: 40 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* WhatsApp Number Prompt Modal */}
      <Modal
        visible={whatsappModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setWhatsappModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="logo-whatsapp" size={22} color={Colors.success} />
                <Text style={styles.modalTitle}>Confirm WhatsApp Number</Text>
              </View>
              <TouchableOpacity onPress={() => setWhatsappModalVisible(false)} style={styles.closeBtn}>
                <Ionicons name="close" size={24} color={Colors.text} />
              </TouchableOpacity>
            </View>
            
            <View style={{ paddingHorizontal: 24, paddingVertical: 20 }}>
              <Text style={{ ...Typography.bodyMedium, color: Colors.textSecondary, marginBottom: 16 }}>
                Do you want to send the invoice PDF to this WhatsApp number? You can edit the number below if needed.
              </Text>
              
              <Input
                label="WhatsApp Number (10 digits)"
                value={whatsappPhone}
                onChangeText={setWhatsappPhone}
                placeholder="Enter 10-digit WhatsApp number"
                keyboardType="phone-pad"
                icon="call-outline"
              />

              <View style={{ flexDirection: 'row', gap: 12, marginTop: 12 }}>
                <Button
                  title="Cancel"
                  onPress={() => setWhatsappModalVisible(false)}
                  variant="secondary"
                  style={{ flex: 1 }}
                />
                <Button
                  title="Send Invoice"
                  onPress={confirmSaveAndShareWhatsApp}
                  variant="success"
                  style={{ flex: 1.2 }}
                  icon="send"
                />
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function formatIndianNumber(num) {
  if (isNaN(num)) return '0';
  const str = Math.round(num).toString();
  let result = '';
  let count = 0;
  for (let i = str.length - 1; i >= 0; i--) {
    if (count === 3 || (count > 3 && (count - 3) % 2 === 0)) result = ',' + result;
    result = str[i] + result;
    count++;
  }
  return result;
}

const styles = StyleSheet.create({
  partyNameContainer: {
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(79, 106, 245, 0.08)',
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    backgroundColor: 'rgba(79, 106, 245, 0.02)',
  },
  partyNameHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  partyNameSelectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.accentSurface,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: 'rgba(79, 106, 245, 0.12)',
  },
  partyNameSelectButtonText: {
    ...Typography.captionSemibold,
    color: Colors.accent,
  },
  customerFieldsGroup: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  customerHalfField: {
    flex: 1,
  },
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
    marginLeft: Spacing.md,
  },
  headerTitle: {
    ...Typography.h3,
    color: Colors.text,
  },
  headerSub: {
    ...Typography.small,
    color: Colors.textTertiary,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.lg,
  },
  sectionCard: {
    marginBottom: Spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  sectionIconCircle: {
    width: 38,
    height: 38,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
    shadowColor: 'rgba(15, 32, 80, 0.04)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 4,
  },
  sectionTitle: {
    ...Typography.h3,
    color: Colors.text,
    flex: 1,
  },
  rowCount: {
    ...Typography.caption,
    color: Colors.textTertiary,
  },
  rowCard: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: '#EDF1F7',
    shadowColor: 'rgba(15, 32, 80, 0.02)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 1,
  },
  rowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  rowLabel: {
    ...Typography.captionMedium,
    color: Colors.textSecondary,
  },
  removeRowBtn: {
    padding: 2,
  },
  rowFields: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  rowFieldWrap: {
    flex: 1,
  },
  rowFieldHalf: {
    minWidth: '45%',
  },
  rowFieldThird: {
    minWidth: '30%',
  },
  addRowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: Colors.accent,
    borderRadius: BorderRadius.lg,
    backgroundColor: 'rgba(79, 106, 245, 0.02)',
    marginTop: Spacing.sm,
  },
  addRowText: {
    ...Typography.bodySemibold,
    color: Colors.accent,
    marginLeft: Spacing.xs,
  },
  totalCard: {
    marginBottom: Spacing.lg,
    backgroundColor: Colors.primary,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLabel: {
    ...Typography.bodySemibold,
    color: 'rgba(255,255,255,0.8)',
  },
  totalValue: {
    ...Typography.h2,
    color: '#fff',
  },
  actionsContainer: {
    gap: Spacing.md,
  },
  actionBtn: {
    // empty
  },
  dropdownWrap: {
    marginBottom: Spacing.lg,
  },
  dropdownLabel: {
    ...Typography.captionSemibold,
    color: Colors.textSecondary,
    marginBottom: Spacing.xs + 2,
  },
  dropdownButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    minHeight: 50, // Matches Input minHeight perfectly!
    overflow: 'hidden',
  },
  dropdownText: {
    ...Typography.body,
    color: Colors.text,
    flex: 1,
    paddingVertical: 0, // Perfectly centers text vertically!
    minWidth: 0,
  },
  placeholder: {
    color: Colors.textTertiary,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    paddingBottom: 34,
    maxHeight: '75%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modalTitle: {
    ...Typography.bodySemibold,
    color: Colors.text,
    fontSize: 18,
  },
  closeBtn: {
    padding: Spacing.xs,
  },
  modalList: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
  },
  modalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  modalItemIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#EBF5FB',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  modalItemText: {
    ...Typography.bodySemibold,
    color: Colors.text,
  },
  modalItemSub: {
    ...Typography.small,
    color: Colors.textTertiary,
    marginTop: 2,
  },
  customForm: {
    paddingVertical: Spacing.md,
    gap: Spacing.md,
  },
  previewContainer: {
    padding: 0,
    backgroundColor: '#F5F5F5',
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    marginBottom: Spacing.xl,
  },
  previewBadgeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EAECEE',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: Spacing.sm,
  },
  previewBadgeText: {
    ...Typography.bodySemibold,
    color: Colors.textSecondary,
    fontSize: 13,
  },
  paperSheet: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    margin: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: '#D0D3D4',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 3,
  },
  paperHeader: {
    borderBottomWidth: 1,
    borderBottomColor: '#000',
    paddingBottom: 10,
    marginBottom: 15,
  },
  paperHeaderTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  paperBN: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#000',
    fontFamily: Platform.OS === 'web' ? 'Times New Roman, Times, serif' : 'serif',
    width: 60,
  },
  paperShopName: {
    fontSize: 22,
    fontWeight: '900',
    color: '#000',
    textAlign: 'center',
    flex: 1,
    fontFamily: Platform.OS === 'web' ? 'Times New Roman, Times, serif' : 'serif',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  paperPhone: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#000',
    textAlign: 'right',
    fontFamily: Platform.OS === 'web' ? 'Times New Roman, Times, serif' : 'serif',
    width: 140,
  },
  paperShopLoc: {
    fontSize: 12,
    color: '#000',
    textAlign: 'center',
    marginTop: 4,
    fontWeight: 'bold',
    fontFamily: Platform.OS === 'web' ? 'Times New Roman, Times, serif' : 'serif',
  },
  paperCustomerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 15,
  },
  paperMsCol: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginRight: 10,
  },
  paperCustomerLabel: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#000',
    fontFamily: Platform.OS === 'web' ? 'Times New Roman, Times, serif' : 'serif',
  },
  paperDottedLine: {
    flex: 1,
    borderBottomWidth: 1,
    borderBottomColor: '#000',
    borderStyle: 'dotted',
    paddingBottom: 2,
    minHeight: 18,
  },
  paperCustomerVal: {
    fontSize: 13,
    color: '#000',
    fontWeight: 'bold',
    fontFamily: Platform.OS === 'web' ? 'Times New Roman, Times, serif' : 'serif',
  },
  paperDatePlaceCol: {
    width: 180,
  },
  paperDatePlaceRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'flex-end',
  },
  paperCustomFieldsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    borderWidth: 1,
    borderColor: '#000',
    borderRadius: 4,
    padding: 8,
    marginBottom: 15,
    gap: 8,
  },
  paperCustomFieldItem: {
    width: '48%',
    flexDirection: 'row',
    gap: 4,
  },
  paperCustomFieldLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#333',
    fontFamily: Platform.OS === 'web' ? 'Times New Roman, Times, serif' : 'serif',
  },
  paperCustomFieldValue: {
    fontSize: 12,
    color: '#000',
    fontFamily: Platform.OS === 'web' ? 'Times New Roman, Times, serif' : 'serif',
    flex: 1,
  },
  paperTable: {
    borderWidth: 1,
    borderColor: '#000',
    marginBottom: 10,
  },
  paperTableHeader: {
    flexDirection: 'row',
    backgroundColor: '#F2F3F4',
    borderBottomWidth: 1,
    borderBottomColor: '#000',
  },
  paperTableHeaderCell: {
    flex: 1,
    padding: 6,
    borderRightWidth: 1,
    borderRightColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  paperTableHeaderText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#000',
    textAlign: 'center',
    fontFamily: Platform.OS === 'web' ? 'Times New Roman, Times, serif' : 'serif',
  },
  paperTableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#000',
    minHeight: 28,
  },
  paperTableCell: {
    flex: 1,
    padding: 6,
    borderRightWidth: 1,
    borderRightColor: '#000',
    justifyContent: 'center',
  },
  paperTableCellText: {
    fontSize: 11,
    color: '#000',
    fontFamily: Platform.OS === 'web' ? 'Times New Roman, Times, serif' : 'serif',
  },
  paperTotalsContainer: {
    alignSelf: 'flex-end',
    width: 220,
    borderWidth: 1,
    borderColor: '#000',
    borderTopWidth: 0,
    padding: 8,
    gap: 4,
    marginBottom: 20,
  },
  paperTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  paperTotalLabel: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#000',
    fontFamily: Platform.OS === 'web' ? 'Times New Roman, Times, serif' : 'serif',
  },
  paperTotalValue: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#000',
    fontFamily: Platform.OS === 'web' ? 'Times New Roman, Times, serif' : 'serif',
    textAlign: 'right',
  },
  paperSignatureRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginTop: 40,
    marginBottom: 10,
  },
  paperSignatureText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#000',
    fontFamily: Platform.OS === 'web' ? 'Times New Roman, Times, serif' : 'serif',
  },
  paperSignatureLine: {
    flex: 1,
    borderBottomWidth: 1,
    borderBottomColor: '#000',
    marginLeft: 8,
    marginBottom: 2,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.md,
  },
  settingTextContainer: {
    flex: 1,
    paddingRight: Spacing.md,
  },
  settingLabel: {
    ...Typography.bodySemibold,
    color: Colors.text,
  },
  settingDesc: {
    ...Typography.caption,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  settingDivider: {
    height: 1,
    backgroundColor: Colors.divider,
  },
  taxInputContainer: {
    marginTop: -Spacing.xs,
    marginBottom: Spacing.sm,
    paddingLeft: Spacing.xs,
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
  },
  canvasSolidUnderline: {
    flex: 1,
    borderBottomWidth: 1,
    borderBottomColor: '#000',
    paddingBottom: 2,
    marginLeft: 6,
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
    marginLeft: 6,
  },
  canvasPlaceholderVal: {
    fontSize: 11,
    color: '#777',
    fontStyle: 'italic',
  },
});
