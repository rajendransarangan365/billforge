// @ts-nocheck
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../src/theme';
import { useAuth } from '../src/context/AuthContext';
import { getDatabase, registerCompanyOwner } from '../src/database/db';

const DEFAULT_MATERIALS = [
  { name: 'River Sand', price_per_unit: '3200', unit_type: 'unit' },
  { name: 'M-Sand', price_per_unit: '2600', unit_type: 'unit' },
  { name: 'P-Sand', price_per_unit: '2900', unit_type: 'unit' },
  { name: 'Blue Metal (20mm)', price_per_unit: '2400', unit_type: 'unit' },
  { name: 'Blue Metal (40mm)', price_per_unit: '2200', unit_type: 'unit' },
  { name: 'Quarry Dust', price_per_unit: '1200', unit_type: 'unit' },
  { name: 'Soil / Gravel', price_per_unit: '1800', unit_type: 'unit' },
];

export default function OwnerRegisterScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { loginOwner } = useAuth();

  // Company fields
  const [companyName, setCompanyName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('sarangan365@gmail.com');
  const [password, setPassword] = useState('');
  const [location, setLocation] = useState('');
  const [address, setAddress] = useState('');

  // Materials pricing list
  const [materials, setMaterials] = useState(DEFAULT_MATERIALS);

  // Driver details
  const [driverName, setDriverName] = useState('Ramesh Driver');
  const [driverPhone, setDriverPhone] = useState('9876543210');
  const [vehicleNo, setVehicleNo] = useState('TN 38 AB 1234');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const updateMaterialPrice = (index: number, price: string) => {
    setMaterials((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], price_per_unit: price };
      return updated;
    });
  };

  const handleRegister = async () => {
    setError('');
    if (!companyName.trim()) { setError('Please enter Quarry / Business Name.'); return; }
    if (!phone.trim() || phone.trim().length < 10) { setError('Please enter a valid 10-digit mobile number.'); return; }
    if (!password.trim() || password.trim().length < 4) { setError('Password must be at least 4 characters.'); return; }

    setLoading(true);
    try {
      const db = await getDatabase();
      const payload = {
        name: companyName.trim(),
        ownerName: ownerName.trim() || 'Quarry Owner',
        phone: phone.trim(),
        email: email.trim() || 'sarangan365@gmail.com',
        password: password.trim(),
        location: location.trim() || 'Tiruppur',
        address: address.trim() || 'Main Quarry Road',
        materials: materials.map((m) => ({
          name: m.name,
          price_per_unit: parseFloat(m.price_per_unit) || 0,
          unit_type: m.unit_type || 'unit',
        })),
        drivers: [
          {
            name: driverName.trim() || 'Ramesh Driver',
            phone: driverPhone.trim() || '9876543210',
            vehicle_no: vehicleNo.trim() || 'TN 38 AB 1234',
          },
        ],
        status: 'pending_approval',
      };

      await registerCompanyOwner(db, payload);
      
      // Dispatch Onboarding Notification Email
      try {
        const { sendOnboardingEmail } = require('../src/services/emailService');
        await sendOnboardingEmail({
          toEmail: email.trim() || 'sarangan365@gmail.com',
          ownerName: ownerName.trim() || companyName.trim(),
          quarryName: companyName.trim(),
          status: 'pending_approval',
        });
      } catch (err) {}

      Alert.alert(
        'Registration Submitted ⏳',
        `Thank you for registering ${companyName.trim()}!\n\nAn onboarding confirmation email has been sent to ${email.trim() || 'sarangan365@gmail.com'}.\n\nYour quarry registration is currently pending approval by the Admin. Once Admin approves your business, you can log in to your portal.`,
        [
          {
            text: 'Go to Owner Login',
            onPress: () => router.replace('/owner-login'),
          },
        ]
      );
    } catch (e) {
      console.error('Registration failed:', e);
      setError('Registration failed. Please check details and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 30 },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Back */}
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={Colors.text} />
        </TouchableOpacity>

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.iconWrap}>
            <Ionicons name="business" size={32} color={Colors.primary} />
          </View>
          <Text style={styles.title}>Register Quarry Account</Text>
          <Text style={styles.subtitle}>
            Set up your quarry business details, default material pricing, and transport drivers in one step.
          </Text>
        </View>

        {/* Section 1: Business Profile */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Ionicons name="location-outline" size={18} color={Colors.primary} />
            <Text style={styles.sectionTitle}>1. Business & Company Details</Text>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Quarry / Business Name *</Text>
            <View style={styles.inputWrap}>
              <Ionicons name="storefront-outline" size={18} color={Colors.textTertiary} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                value={companyName}
                onChangeText={setCompanyName}
                placeholder="e.g. Sri Murugan Blue Metals & Sand Quarry"
                placeholderTextColor={Colors.textDisabled}
              />
            </View>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Owner / Manager Name</Text>
            <View style={styles.inputWrap}>
              <Ionicons name="person-outline" size={18} color={Colors.textTertiary} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                value={ownerName}
                onChangeText={setOwnerName}
                placeholder="e.g. R. Saravanan"
                placeholderTextColor={Colors.textDisabled}
              />
            </View>
          </View>

          <View style={styles.rowTwo}>
            <View style={[styles.fieldGroup, { flex: 1 }]}>
              <Text style={styles.label}>Mobile Number *</Text>
              <View style={styles.inputWrap}>
                <Ionicons name="call-outline" size={18} color={Colors.textTertiary} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  value={phone}
                  onChangeText={setPhone}
                  placeholder="9876543210"
                  placeholderTextColor={Colors.textDisabled}
                  keyboardType="phone-pad"
                  maxLength={10}
                />
              </View>
            </View>

            <View style={[styles.fieldGroup, { flex: 1 }]}>
              <Text style={styles.label}>Email Address (for Invoices & Reset)</Text>
              <View style={styles.inputWrap}>
                <Ionicons name="mail-outline" size={18} color={Colors.textTertiary} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="sarangan365@gmail.com"
                  placeholderTextColor={Colors.textDisabled}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>
            </View>
          </View>

          <View style={styles.rowTwo}>
            <View style={[styles.fieldGroup, { flex: 1 }]}>
              <Text style={styles.label}>Account Password *</Text>
              <View style={styles.inputWrap}>
                <Ionicons name="lock-closed-outline" size={18} color={Colors.textTertiary} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Password"
                  placeholderTextColor={Colors.textDisabled}
                  secureTextEntry
                />
              </View>
            </View>
          </View>

          <View style={styles.rowTwo}>
            <View style={[styles.fieldGroup, { flex: 1 }]}>
              <Text style={styles.label}>City / Location</Text>
              <View style={styles.inputWrap}>
                <Ionicons name="map-outline" size={18} color={Colors.textTertiary} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  value={location}
                  onChangeText={setLocation}
                  placeholder="e.g. Tiruppur / Coimbatore"
                  placeholderTextColor={Colors.textDisabled}
                />
              </View>
            </View>

            <View style={[styles.fieldGroup, { flex: 1 }]}>
              <Text style={styles.label}>Full Address</Text>
              <View style={styles.inputWrap}>
                <Ionicons name="home-outline" size={18} color={Colors.textTertiary} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  value={address}
                  onChangeText={setAddress}
                  placeholder="e.g. SF No 204, Quarry Zone"
                  placeholderTextColor={Colors.textDisabled}
                />
              </View>
            </View>
          </View>
        </View>

        {/* Section 2: Material Default Rates */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Ionicons name="cube-outline" size={18} color={Colors.primary} />
            <Text style={styles.sectionTitle}>2. Material Catalog & Pricing per Unit (₹)</Text>
          </View>
          <Text style={styles.sectionHelp}>
            Set your default selling price per unit. These prices will automatically calculate when billing customers.
          </Text>

          {materials.map((mat, idx) => (
            <View key={mat.name} style={styles.materialRow}>
              <Text style={styles.materialName}>{mat.name}</Text>
              <View style={styles.priceInputWrap}>
                <Text style={styles.currencyPrefix}>₹</Text>
                <TextInput
                  style={styles.priceInput}
                  value={mat.price_per_unit}
                  onChangeText={(val) => updateMaterialPrice(idx, val)}
                  keyboardType="numeric"
                  placeholder="0"
                />
                <Text style={styles.unitSuffix}>/{mat.unit_type}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Section 3: Driver & Vehicle Assignment Setup */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Ionicons name="car-sport-outline" size={18} color={Colors.primary} />
            <Text style={styles.sectionTitle}>3. Driver & Lorry Assignment Setup</Text>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Default Driver Name</Text>
            <View style={styles.inputWrap}>
              <Ionicons name="person-circle-outline" size={18} color={Colors.textTertiary} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                value={driverName}
                onChangeText={setDriverName}
                placeholder="e.g. Ramesh (Driver)"
                placeholderTextColor={Colors.textDisabled}
              />
            </View>
          </View>

          <View style={styles.rowTwo}>
            <View style={[styles.fieldGroup, { flex: 1 }]}>
              <Text style={styles.label}>Driver Phone</Text>
              <View style={styles.inputWrap}>
                <Ionicons name="call-outline" size={18} color={Colors.textTertiary} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  value={driverPhone}
                  onChangeText={setDriverPhone}
                  placeholder="9876543210"
                  keyboardType="phone-pad"
                  placeholderTextColor={Colors.textDisabled}
                />
              </View>
            </View>

            <View style={[styles.fieldGroup, { flex: 1 }]}>
              <Text style={styles.label}>Lorry / Vehicle No.</Text>
              <View style={styles.inputWrap}>
                <Ionicons name="car-outline" size={18} color={Colors.textTertiary} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  value={vehicleNo}
                  onChangeText={setVehicleNo}
                  placeholder="TN 38 AB 1234"
                  placeholderTextColor={Colors.textDisabled}
                  autoCapitalize="characters"
                />
              </View>
            </View>
          </View>
        </View>

        {/* Error message */}
        {error ? (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle-outline" size={16} color={Colors.danger} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {/* Register Submit Button */}
        <TouchableOpacity
          style={[styles.registerBtn, loading && styles.registerBtnDisabled]}
          onPress={handleRegister}
          disabled={loading}
          activeOpacity={0.8}
        >
          {loading ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator color="#FFF" size="small" />
              <Text style={styles.registerBtnText}>Creating Account & Setting Up...</Text>
            </View>
          ) : (
            <>
              <Text style={styles.registerBtnText}>Complete Quarry Registration</Text>
              <Ionicons name="arrow-forward" size={18} color="#FFF" />
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  scroll: { paddingHorizontal: 20 },
  backBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: Colors.surface,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.border,
    marginBottom: 16,
  },
  header: { alignItems: 'center', marginBottom: 24 },
  iconWrap: {
    width: 64, height: 64, borderRadius: 18,
    backgroundColor: Colors.primarySurface,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.primaryBorder,
    marginBottom: 12,
  },
  title: { fontSize: 24, fontWeight: '800', color: Colors.navy, textAlign: 'center' },
  subtitle: { fontSize: 13, color: Colors.textSecondary, textAlign: 'center', marginTop: 6, lineHeight: 18 },
  sectionCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 14,
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: Colors.navy },
  sectionHelp: { fontSize: 12, color: Colors.textTertiary, marginTop: -4 },
  fieldGroup: { gap: 6 },
  rowTwo: { flexDirection: 'row', gap: 10 },
  label: { fontSize: 12, fontWeight: '600', color: Colors.text },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.background,
    borderWidth: 1, borderColor: Colors.border,
    borderRadius: 10, overflow: 'hidden',
  },
  inputIcon: { paddingLeft: 12 },
  input: {
    flex: 1, height: 46,
    paddingHorizontal: 10,
    fontSize: 14,
    color: Colors.text,
  },
  materialRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: Colors.borderLight,
  },
  materialName: { fontSize: 13, fontWeight: '600', color: Colors.text, flex: 1 },
  priceInputWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.background,
    borderWidth: 1, borderColor: Colors.border,
    borderRadius: 8, paddingHorizontal: 8, height: 38,
  },
  currencyPrefix: { fontSize: 13, fontWeight: '600', color: Colors.primary, marginRight: 4 },
  priceInput: { width: 70, height: 38, fontSize: 14, fontWeight: '700', color: Colors.text, textAlign: 'right' },
  unitSuffix: { fontSize: 11, color: Colors.textTertiary, marginLeft: 4 },
  errorBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.dangerLight,
    borderRadius: 10, padding: 12,
    borderWidth: 1, borderColor: Colors.dangerBorder,
    marginBottom: 16,
  },
  errorText: { fontSize: 12, color: Colors.danger, flex: 1 },
  registerBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, height: 54, borderRadius: 14,
    backgroundColor: Colors.primary,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 5,
  },
  registerBtnDisabled: { opacity: 0.7 },
  registerBtnText: { fontSize: 16, fontWeight: '700', color: '#FFF' },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
});
