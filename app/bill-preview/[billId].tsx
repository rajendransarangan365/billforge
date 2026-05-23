// @ts-nocheck
import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Alert, ActivityIndicator, ScrollView, Modal, KeyboardAvoidingView, Platform, Linking,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius } from '../../src/theme';
import { Card, Button, Input } from '../../src/components';
import { getDatabase, getBillById, getTemplateById, getCompanyProfile } from '../../src/database/db';
import { generatePDF, sharePDF } from '../../src/services/pdfGenerator';

export default function BillPreviewScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { billId } = useLocalSearchParams();
  const [bill, setBill] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sharing, setSharing] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [companyProfile, setCompanyProfile] = useState(null);
  const [isWhatsAppModalVisible, setIsWhatsAppModalVisible] = useState(false);
  const [whatsappPhone, setWhatsappPhone] = useState('');

  useEffect(() => {
    loadBill();
  }, [billId]);

  const loadBill = async () => {
    try {
      const db = await getDatabase();
      const b = await getBillById(db, parseInt(billId));
      if (b) {
        setBill(b);
        const profile = await getCompanyProfile(db);
        if (profile) {
          setCompanyProfile(profile);
        }
      }
    } catch (error) {
      console.error('Error loading bill:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateWhatsAppMessage = () => {
    if (!bill) return '';
    const headerData = JSON.parse(bill.header_data_json || '{}');
    const customerName = bill.customer_name || 'Valued Customer';
    const billNum = bill.bill_number || `#${bill.id}`;
    const shopName = companyProfile?.name || 'our shop';
    const amount = formatCurrency(bill.total_amount);
    
    // Find if there is an uncleared balance
    let balanceStr = '';
    const balanceKey = Object.keys(headerData).find(key => {
      const norm = key.toLowerCase().replace(/[\s_-]/g, '');
      return norm === 'balance' || norm === 'balanceamount' || norm === 'unclearedbalance';
    });
    if (balanceKey && headerData[balanceKey]) {
      balanceStr = `\nUncleared Balance: ${formatCurrency(parseFloat(headerData[balanceKey]))}`;
    }

    const dateStr = new Date(bill.created_at).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });

    return `Dear ${customerName},\n\nPlease find here the summary of your Invoice ${billNum} from ${shopName}:\n\nDate: ${dateStr}\nTotal Amount: ${amount}${balanceStr}\n\nThank you for your business!`;
  };

  const handleOpenWhatsApp = () => {
    if (!bill) return;
    const headerData = JSON.parse(bill.header_data_json || '{}');
    const phone = headerData.customer_phone || '';
    setWhatsappPhone(phone);
    setIsWhatsAppModalVisible(true);
  };

  const handleSendWhatsApp = async () => {
    if (!whatsappPhone.trim()) {
      Alert.alert('Error', 'Please enter a valid phone number.');
      return;
    }

    // Clean phone number: keep only digits
    let cleanedPhone = whatsappPhone.replace(/\D/g, '');
    
    // If it's a 10-digit number (common in India), pre-fill with country code '91' by default if not already starting with 91
    if (cleanedPhone.length === 10) {
      cleanedPhone = '91' + cleanedPhone;
    } else if (cleanedPhone.length === 12 && cleanedPhone.startsWith('91')) {
      // already has 91 prefix
    } else if (cleanedPhone.length < 10) {
      Alert.alert('Error', 'Please enter a valid phone number.');
      return;
    }

    const message = generateWhatsAppMessage();
    const encodedMessage = encodeURIComponent(message);
    const whatsappUrl = `https://wa.me/${cleanedPhone}?text=${encodedMessage}`;

    try {
      await Linking.openURL(whatsappUrl);
      setIsWhatsAppModalVisible(false);
    } catch (error) {
      console.error('Error opening WhatsApp:', error);
      Alert.alert('Error', 'Failed to open WhatsApp. Make sure the app is installed or try on a browser.');
    }
  };

  const handleShare = async () => {
    if (!bill) return;
    setSharing(true);
    try {
      if (bill.pdf_uri) {
        await sharePDF(bill.pdf_uri);
      } else {
        // Regenerate PDF
        await handleRegeneratePDF(true);
      }
    } catch (error) {
      console.error('Share error:', error);
      Alert.alert('Error', 'Failed to share PDF.');
    } finally {
      setSharing(false);
    }
  };

  const handleRegeneratePDF = async (shareAfter = false) => {
    if (!bill) return;
    setRegenerating(true);
    try {
      const db = await getDatabase();
      const template = bill.template_id ? await getTemplateById(db, bill.template_id) : null;
      const profile = await getCompanyProfile(db);

      const headerFields = template ? JSON.parse(template.header_fields_json || '[]') : [];
      const tableFields = template ? JSON.parse(template.table_fields_json || '[]') : [];
      const headerData = JSON.parse(bill.header_data_json || '{}');
      const rowData = JSON.parse(bill.row_data_json || '[]');

      const result = await generatePDF({
        companyProfile: profile || {},
        headerData,
        rowData,
        headerFields,
        tableFields,
        templateName: template?.name || 'Invoice',
        totalAmount: bill.total_amount,
      });

      if (result.success) {
        if (shareAfter) {
          await sharePDF(result.uri);
        } else {
          Alert.alert('PDF Generated', 'PDF has been regenerated successfully.');
        }
      } else {
        Alert.alert('Error', 'Failed to generate PDF.');
      }
    } catch (error) {
      console.error('Regenerate error:', error);
      Alert.alert('Error', 'Failed to regenerate PDF.');
    } finally {
      setRegenerating(false);
    }
  };

  const formatCurrency = (amount) => {
    if (!amount) return 'Rs. 0';
    const str = Math.round(amount).toString();
    let result = '';
    let count = 0;
    for (let i = str.length - 1; i >= 0; i--) {
      if (count === 3 || (count > 3 && (count - 3) % 2 === 0)) result = ',' + result;
      result = str[i] + result;
      count++;
    }
    return `Rs. ${result}`;
  };

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Colors.accent} />
        </View>
      </View>
    );
  }

  if (!bill) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Bill Not Found</Text>
        </View>
      </View>
    );
  }

  const headerData = JSON.parse(bill.header_data_json || '{}');
  const rowData = JSON.parse(bill.row_data_json || '[]');

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.text} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {bill.customer_name || bill.bill_number || `Bill #${bill.id}`}
          </Text>
          <Text style={styles.headerSub}>{bill.template_name || 'Bill'}</Text>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Bill Summary */}
        <Card style={styles.summaryCard} variant="elevated">
          <View style={styles.summaryTop}>
            <View style={styles.billIconLarge}>
              <Ionicons name="receipt" size={28} color={Colors.primary} />
            </View>
            <View style={styles.summaryInfo}>
              <Text style={styles.billNumber}>{bill.bill_number || `#${bill.id}`}</Text>
              <Text style={styles.billTemplateName}>{bill.template_name || 'Custom'}</Text>
            </View>
            <View style={styles.totalBadge}>
              <Text style={styles.totalBadgeLabel}>Total</Text>
              <Text style={styles.totalBadgeValue}>{formatCurrency(bill.total_amount)}</Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.metaGrid}>
            {bill.customer_name && (
              <View style={styles.metaItem}>
                <Ionicons name="person-outline" size={14} color={Colors.textTertiary} />
                <Text style={styles.metaValue}>{bill.customer_name}</Text>
              </View>
            )}
            <View style={styles.metaItem}>
              <Ionicons name="calendar-outline" size={14} color={Colors.textTertiary} />
              <Text style={styles.metaValue}>
                {new Date(bill.created_at).toLocaleDateString('en-IN', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                })}
              </Text>
            </View>
            <View style={styles.metaItem}>
              <Ionicons name="time-outline" size={14} color={Colors.textTertiary} />
              <Text style={styles.metaValue}>
                {new Date(bill.created_at).toLocaleTimeString('en-IN', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </Text>
            </View>
          </View>
        </Card>

        {/* Header Data */}
        {Object.keys(headerData).length > 0 && (
          <Card style={styles.detailCard}>
            <Text style={styles.sectionTitle}>Bill Details</Text>
            {Object.entries(headerData).map(([key, value]) => {
              if (!value) return null;
              if (key === 'customer_phone' || key === 'customer_address') return null;
              let displayVal = value;
              if (typeof value === 'string' && value.match(/^\d{4}-\d{2}-\d{2}/)) {
                try {
                   displayVal = new Date(value).toLocaleDateString('en-IN');
                } catch (e) {}
              }
              return (
                <View key={key} style={styles.detailRow}>
                  <Text style={styles.detailLabel}>{formatLabel(key)}</Text>
                  <Text style={styles.detailValue}>{String(displayVal)}</Text>
                </View>
              );
            })}
          </Card>
        )}

        {/* Internal Customer Records Card */}
        {(headerData.customer_phone || headerData.customer_address) && (
          <Card style={styles.detailCard}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.md, gap: 6 }}>
              <Ionicons name="people-outline" size={16} color={Colors.primary} />
              <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>Customer Info (Internal Records Only)</Text>
            </View>
            {headerData.customer_phone ? (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Contact Phone</Text>
                <Text style={styles.detailValue}>{headerData.customer_phone}</Text>
              </View>
            ) : null}
            {headerData.customer_address ? (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Resident Address</Text>
                <Text style={styles.detailValue}>{headerData.customer_address}</Text>
              </View>
            ) : null}
          </Card>
        )}

        {/* Row Data */}
        {rowData.length > 0 && (
          <Card style={styles.detailCard}>
            <Text style={styles.sectionTitle}>Line Items ({rowData.length})</Text>
            {rowData.map((row, idx) => (
              <View key={idx} style={[styles.lineItem, idx > 0 && styles.lineItemBorder]}>
                <Text style={styles.lineItemNum}>{idx + 1}</Text>
                <View style={styles.lineItemContent}>
                  {Object.entries(row).map(([key, value]) => {
                    if (!value) return null;
                    return (
                      <Text key={key} style={styles.lineItemField}>
                        <Text style={styles.lineItemFieldLabel}>{formatLabel(key)}: </Text>
                        {String(value)}
                      </Text>
                    );
                  })}
                </View>
              </View>
            ))}
          </Card>
        )}

        {/* Action Buttons */}
        <View style={styles.actions}>
          <Button
            title="Share PDF"
            onPress={handleShare}
            loading={sharing}
            variant="primary"
            fullWidth
            size="lg"
            icon="share-outline"
            style={styles.actionBtn}
          />
          <Button
            title="Share via WhatsApp"
            onPress={handleOpenWhatsApp}
            variant="primary"
            fullWidth
            size="lg"
            icon="logo-whatsapp"
            style={[styles.actionBtn, styles.whatsappBtn]}
          />
          <Button
            title="Regenerate PDF"
            onPress={() => handleRegeneratePDF(false)}
            loading={regenerating}
            variant="outline"
            fullWidth
            size="lg"
            icon="refresh-outline"
            style={styles.actionBtn}
          />
        </View>

        <View style={{ height: 30 }} />
      </ScrollView>

      {/* WhatsApp Modal */}
      <Modal
        visible={isWhatsAppModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsWhatsAppModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="logo-whatsapp" size={24} color="#25D366" />
                <Text style={styles.modalTitle}>Share via WhatsApp</Text>
              </View>
              <TouchableOpacity onPress={() => setIsWhatsAppModalVisible(false)}>
                <Ionicons name="close" size={24} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.modalForm}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <Text style={styles.promptQuestion}>
                Do you want to send the invoice summary to this number?
              </Text>

              <Input
                label="WhatsApp Phone Number"
                value={whatsappPhone}
                onChangeText={setWhatsappPhone}
                placeholder="e.g. 9876543210"
                keyboardType="phone-pad"
                icon="call-outline"
              />

              <Text style={styles.previewLabel}>Message Preview</Text>
              <View style={styles.previewBox}>
                <ScrollView nestedScrollEnabled style={{ maxHeight: 120 }}>
                  <Text style={styles.previewText}>{generateWhatsAppMessage()}</Text>
                </ScrollView>
              </View>

              <View style={styles.infoCard}>
                <Ionicons name="information-circle-outline" size={18} color="#25D366" style={{ marginTop: 2 }} />
                <Text style={styles.infoText}>
                  This opens a direct WhatsApp chat window. Since WhatsApp does not support sending physical PDF files via link sharing, you can easily attach the generated PDF using the attachment clip in the chat window.
                </Text>
              </View>

              <View style={styles.modalButtons}>
                <Button
                  title="Cancel"
                  onPress={() => setIsWhatsAppModalVisible(false)}
                  variant="outline"
                  style={styles.modalBtn}
                />
                <Button
                  title="Send"
                  onPress={handleSendWhatsApp}
                  variant="primary"
                  style={[styles.modalBtn, styles.whatsappBtn]}
                  icon="logo-whatsapp"
                />
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

function formatLabel(fieldName) {
  const norm = fieldName.toLowerCase().replace(/[\s_-]/g, '');
  if (norm === 'balance' || norm === 'balanceamount' || norm === 'unclearedbalance') {
    return 'Uncleared Balance';
  }
  return fieldName.replace(/([A-Z])/g, ' $1').trim().replace(/^\w/, c => c.toUpperCase());
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
  summaryCard: {
    marginBottom: Spacing.lg,
  },
  summaryTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  billIconLarge: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: Colors.accentSurface,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  summaryInfo: {
    flex: 1,
  },
  billNumber: {
    ...Typography.h3,
    color: Colors.text,
  },
  billTemplateName: {
    ...Typography.caption,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  totalBadge: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    alignItems: 'flex-end',
  },
  totalBadgeLabel: {
    ...Typography.small,
    color: 'rgba(255,255,255,0.7)',
  },
  totalBadgeValue: {
    ...Typography.bodySemibold,
    color: '#fff',
  },
  divider: {
    height: 1,
    backgroundColor: Colors.divider,
    marginVertical: Spacing.md,
  },
  metaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.lg,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs + 2,
  },
  metaValue: {
    ...Typography.caption,
    color: Colors.textSecondary,
  },
  detailCard: {
    marginBottom: Spacing.lg,
  },
  sectionTitle: {
    ...Typography.bodySemibold,
    color: Colors.text,
    marginBottom: Spacing.md,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  detailLabel: {
    ...Typography.caption,
    color: Colors.textSecondary,
  },
  detailValue: {
    ...Typography.bodyMedium,
    color: Colors.text,
    textAlign: 'right',
    flex: 1,
    marginLeft: Spacing.md,
  },
  lineItem: {
    flexDirection: 'row',
    paddingVertical: Spacing.sm + 2,
  },
  lineItemBorder: {
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
  },
  lineItemNum: {
    ...Typography.captionMedium,
    color: Colors.textTertiary,
    width: 24,
    textAlign: 'center',
  },
  lineItemContent: {
    flex: 1,
  },
  lineItemField: {
    ...Typography.caption,
    color: Colors.text,
    marginBottom: 2,
  },
  lineItemFieldLabel: {
    color: Colors.textTertiary,
    fontWeight: '500',
  },
  actions: {
    gap: Spacing.md,
    marginTop: Spacing.sm,
  },
  actionBtn: {},
  whatsappBtn: {
    backgroundColor: '#25D366',
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
    padding: Spacing.xl,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
    paddingBottom: Spacing.sm,
  },
  modalTitle: {
    ...Typography.h3,
    color: Colors.text,
  },
  modalForm: {
    marginBottom: Spacing.md,
  },
  promptQuestion: {
    ...Typography.bodyMedium,
    color: Colors.text,
    marginBottom: Spacing.md,
  },
  previewLabel: {
    ...Typography.captionMedium,
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
    marginTop: Spacing.md,
  },
  previewBox: {
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    marginBottom: Spacing.md,
  },
  previewText: {
    ...Typography.caption,
    color: Colors.textSecondary,
    lineHeight: 18,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  infoCard: {
    flexDirection: 'row',
    backgroundColor: '#E8F8F5',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
    marginVertical: Spacing.lg,
    alignItems: 'flex-start',
  },
  infoText: {
    ...Typography.caption,
    color: '#128C7E',
    flex: 1,
    lineHeight: 18,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.sm,
    marginBottom: Spacing.xl,
  },
  modalBtn: {
    flex: 1,
  },
});
