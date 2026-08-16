// @ts-nocheck
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Dimensions, Platform,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import { Colors, Typography, Spacing, BorderRadius } from '../src/theme';
import { Card, EmptyState } from '../src/components';
import { getDatabase, getConsignments, getDrivers } from '../src/database/db';
import { realtimeService } from '../src/services/pusherRealtime';
import WalkieTalkieModal from '../src/components/WalkieTalkieModal';

const { width: SCREEN_W } = Dimensions.get('window');

export default function LiveTrackingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [drivers, setDrivers] = useState([]);
  const [consignments, setConsignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDriver, setSelectedDriver] = useState(null);
  const [walkieModalVisible, setWalkieModalVisible] = useState(false);
  const [activeWalkieDriver, setActiveWalkieDriver] = useState(null);

  const loadData = useCallback(async () => {
    try {
      const db = await getDatabase();
      const driverList = await getDrivers(db);
      const consignmentList = await getConsignments(db);
      setDrivers(driverList);
      setConsignments(consignmentList.filter(c => c.status !== 'delivered'));
      if (driverList.length > 0 && !selectedDriver) {
        setSelectedDriver(driverList[0]);
      }
    } catch (e) {
      console.error('Live tracking load error:', e);
    } finally {
      setLoading(false);
    }
  }, [selectedDriver]);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  // Production Real-Time subscription: moves map markers instantly when driver GPS changes
  useEffect(() => {
    realtimeService.init();

    realtimeService.on('driver-location-changed', (data) => {
      if (!data || !data.driverId) return;
      setDrivers(prev => {
        return prev.map(d => {
          if (String(d.id) === String(data.driverId) || d.name === data.driverName) {
            return { ...d, lat: data.lat, lng: data.lng };
          }
          return d;
        });
      });
    });

    return () => {
      realtimeService.off('driver-location-changed');
    };
  }, []);

  // Leaflet HTML code for free OpenStreetMap live tracking
  const centerLat = selectedDriver?.lat || 11.0168;
  const centerLng = selectedDriver?.lng || 76.9558;

  const leafletHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
      <style>
        body, html { margin:0; padding:0; height:100%; width:100%; }
        #map { height:100%; width:100%; }
      </style>
    </head>
    <body>
      <div id="map"></div>
      <script>
        var map = L.map('map').setView([${centerLat}, ${centerLng}], 12);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: '© OpenStreetMap'
        }).addTo(map);

        ${drivers.map(d => `
          L.marker([${d.lat || 11.0168}, ${d.lng || 76.9558}])
            .addTo(map)
            .bindPopup("<b>🚚 Driver: ${d.name}</b><br>Vehicle: ${d.vehicle_no || 'TN 38 AB 1234'}<br>Status: ${d.status}")
            .openPopup();
        `).join('\n')}
      </script>
    </body>
    </html>
  `;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Live Driver GPS Tracking 📡</Text>
          <Text style={styles.headerSub}>Production Real-Time & Free OpenStreetMap</Text>
        </View>
        <TouchableOpacity
          style={styles.walkieTopBtn}
          onPress={() => {
            setActiveWalkieDriver(drivers[0] || { name: 'Driver Ramesh', id: '1' });
            setWalkieModalVisible(true);
          }}
        >
          <Ionicons name="radio" size={16} color="#FFF" />
          <Text style={styles.walkieTopText}>Walkie-Talkie</Text>
        </TouchableOpacity>
      </View>

      {/* Free Map View Container */}
      <View style={styles.mapContainer}>
        {Platform.OS === 'web' ? (
          <iframe
            srcDoc={leafletHtml}
            style={{ width: '100%', height: '100%', border: 'none' }}
            title="OpenStreetMap"
          />
        ) : (
          <WebView
            originWhitelist={['*']}
            source={{ html: leafletHtml }}
            style={{ flex: 1 }}
          />
        )}
      </View>

      {/* Active Consignments & Walkie Talkie Panel */}
      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Active Delivery Consignments ({consignments.length})</Text>

        {loading ? (
          <ActivityIndicator color={Colors.primary} />
        ) : consignments.length === 0 ? (
          <Text style={styles.emptyText}>No active deliveries right now.</Text>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {consignments.map(c => {
              const isAlert = c.status === 'reached_pickup' || c.status === 'reached_customer';
              return (
                <View key={c.id} style={[styles.cCard, isAlert && styles.cCardAlert]}>
                  <TouchableOpacity
                    onPress={() => {
                      const matchedDriver = drivers.find(d => d.id === c.driver_id);
                      if (matchedDriver) setSelectedDriver(matchedDriver);
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                      <Ionicons name={isAlert ? 'warning' : 'navigate-circle'} size={14} color={isAlert ? '#DC2626' : Colors.primary} />
                      <Text style={[styles.cStatus, { color: isAlert ? '#DC2626' : Colors.primary }]}>
                        {c.status.toUpperCase().replace('_', ' ')}
                      </Text>
                    </View>
                    <Text style={styles.cDriver}>🚚 {c.driver_name}</Text>
                    <Text style={styles.cCustomer}>Customer: {c.customer_name}</Text>
                    <Text style={styles.cCargo}>{c.quantity} {c.unit_type} {c.material_name}</Text>

                    {c.status === 'reached_pickup' && (
                      <View style={styles.alertPill}>
                        <Text style={styles.alertText}>📍 Reached Pickup Yard!</Text>
                      </View>
                    )}
                    {c.status === 'reached_customer' && (
                      <View style={styles.alertPill}>
                        <Text style={styles.alertText}>🏁 Reached Customer Site!</Text>
                      </View>
                    )}
                  </TouchableOpacity>

                  {/* Walkie-Talkie Button on Card */}
                  <TouchableOpacity
                    style={styles.cardWalkieBtn}
                    onPress={() => {
                      setActiveWalkieDriver({ name: c.driver_name, id: c.driver_id });
                      setWalkieModalVisible(true);
                    }}
                  >
                    <Ionicons name="radio-outline" size={14} color={Colors.primary} />
                    <Text style={styles.cardWalkieText}>Walkie-Talkie</Text>
                  </TouchableOpacity>
                </View>
              );
            })}
          </ScrollView>
        )}
      </View>

      {/* Push To Talk Walkie-Talkie Modal */}
      <WalkieTalkieModal
        visible={walkieModalVisible}
        onClose={() => setWalkieModalVisible(false)}
        peerName={activeWalkieDriver?.name || 'Driver Ramesh'}
        peerRole="driver"
        peerId={activeWalkieDriver?.id || '1'}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: Spacing.xl, paddingTop: Spacing.lg, paddingBottom: Spacing.md,
    backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.borderLight,
  },
  backBtn: { padding: 4 },
  headerTitle: { ...Typography.h2, color: Colors.text },
  headerSub: { ...Typography.caption, color: Colors.textSecondary },
  walkieTopBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: Colors.primary, borderRadius: BorderRadius.md,
    paddingHorizontal: 10, paddingVertical: 6,
  },
  walkieTopText: { color: '#FFF', fontSize: 11, fontWeight: '700' },
  mapContainer: { flex: 1, backgroundColor: '#E5E7EB' },
  panel: { backgroundColor: Colors.surface, borderTopWidth: 1, borderTopColor: Colors.borderLight, padding: Spacing.lg },
  panelTitle: { ...Typography.h3, color: Colors.text, marginBottom: 10 },
  emptyText: { ...Typography.caption, color: Colors.textSecondary },
  cCard: {
    width: 210, backgroundColor: Colors.backgroundSecondary, borderRadius: BorderRadius.md,
    padding: Spacing.md, marginRight: 10, borderWidth: 1, borderColor: Colors.borderLight,
  },
  cCardAlert: { backgroundColor: '#FEF2F2', borderColor: '#FCA5A5', borderWidth: 1.5 },
  cStatus: { fontSize: 9, fontWeight: '800' },
  cDriver: { ...Typography.bodyLargeBold, color: Colors.text },
  cCustomer: { ...Typography.caption, color: Colors.textSecondary, marginTop: 2 },
  cCargo: { ...Typography.captionSemibold, color: Colors.primary, marginTop: 2 },
  alertPill: { backgroundColor: '#DC2626', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2, marginTop: 6, alignSelf: 'flex-start' },
  alertText: { color: '#FFF', fontSize: 10, fontWeight: 'bold' },
  cardWalkieBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4,
    backgroundColor: Colors.primarySurface, borderRadius: BorderRadius.sm,
    paddingVertical: 6, marginTop: 8, borderWidth: 1, borderColor: Colors.primary + '40',
  },
  cardWalkieText: { color: Colors.primary, fontSize: 11, fontWeight: '700' },
});
