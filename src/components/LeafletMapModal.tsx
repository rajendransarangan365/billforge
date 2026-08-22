// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ActivityIndicator, Platform, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../theme';

interface Props {
  visible: boolean;
  onClose: () => void;
  mode?: 'pin_delivery' | 'pin_quarry' | 'track_live';
  initialLat?: number;
  initialLng?: number;
  locationName?: string;
  onConfirmLocation?: (location: { lat: number; lng: number; address: string }) => void;
}

export function LeafletMapModal({
  visible,
  onClose,
  mode = 'pin_delivery',
  initialLat = 11.0168, // Default Salem/Coimbatore, TN
  initialLng = 76.9558,
  locationName = 'Delivery Location',
  onConfirmLocation,
}: Props) {
  const [lat, setLat] = useState(initialLat);
  const [lng, setLng] = useState(initialLng);
  const [address, setAddress] = useState(locationName);
  const [locating, setLocating] = useState(false);

  useEffect(() => {
    if (initialLat) setLat(initialLat);
    if (initialLng) setLng(initialLng);
  }, [initialLat, initialLng]);

  const handleDetectLocation = () => {
    if (typeof window !== 'undefined' && 'geolocation' in navigator) {
      setLocating(true);
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const userLat = pos.coords.latitude;
          const userLng = pos.coords.longitude;
          setLat(userLat);
          setLng(userLng);
          setAddress(`GPS Pin: ${userLat.toFixed(4)}, ${userLng.toFixed(4)}`);
          setLocating(false);
        },
        (err) => {
          console.warn('Geolocation error:', err);
          setLocating(false);
          alert('Could not detect location. Please select on map or check location permissions.');
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    } else {
      alert('Geolocation is not supported by your browser.');
    }
  };

  const handleOpenTurnByTurn = () => {
    const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
    Linking.openURL(mapsUrl);
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons
                name={mode === 'track_live' ? 'navigate' : mode === 'pin_quarry' ? 'business' : 'pin'}
                size={22}
                color={Colors.primary}
              />
              <View>
                <Text style={styles.title}>
                  {mode === 'track_live'
                    ? 'Live Vehicle Map Tracking'
                    : mode === 'pin_quarry'
                    ? 'Set Quarry Yard Geo-Location'
                    : 'Pin Delivery Location'}
                </Text>
                <Text style={styles.subTitle}>OpenStreetMap Telemetry System</Text>
              </View>
            </View>

            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <Ionicons name="close" size={22} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Map Viewer Container */}
          <View style={styles.mapWrap}>
            {Platform.OS === 'web' ? (
              <iframe
                title="OpenStreetMap Telemetry"
                width="100%"
                height="100%"
                style={{ border: 0, borderRadius: 12 }}
                src={`https://www.openstreetmap.org/export/embed.html?bbox=${lng - 0.02}%2C${lat - 0.02}%2C${lng + 0.02}%2C${lat + 0.02}&layer=mapnik&marker=${lat}%2C${lng}`}
              />
            ) : (
              <View style={styles.mobileMapFallback}>
                <Ionicons name="map" size={48} color={Colors.primary} />
                <Text style={styles.mobileMapText}>Coordinates: {lat.toFixed(4)}, {lng.toFixed(4)}</Text>
              </View>
            )}

            {/* Detect My Location Button Overlay */}
            <TouchableOpacity style={styles.detectBtn} onPress={handleDetectLocation} disabled={locating}>
              {locating ? (
                <ActivityIndicator size="small" color={Colors.primary} />
              ) : (
                <>
                  <Ionicons name="locate" size={18} color={Colors.primary} />
                  <Text style={styles.detectText}>Detect My Location 🎯</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          {/* Location Info Box & Action Footer */}
          <View style={styles.footer}>
            <View style={{ gap: 4, flex: 1 }}>
              <Text style={styles.addressTitle}>Selected Coordinates & Address:</Text>
              <Text style={styles.addressValue}>{address || `Lat: ${lat.toFixed(4)}, Lng: ${lng.toFixed(4)}`}</Text>
            </View>

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity style={styles.navBtn} onPress={handleOpenTurnByTurn}>
                <Ionicons name="navigate" size={16} color="#FFF" />
                <Text style={styles.navBtnText}>Directions</Text>
              </TouchableOpacity>

              {onConfirmLocation ? (
                <TouchableOpacity
                  style={styles.confirmBtn}
                  onPress={() => {
                    onConfirmLocation({ lat, lng, address });
                    onClose();
                  }}
                >
                  <Ionicons name="checkmark-done" size={16} color="#FFF" />
                  <Text style={styles.confirmBtnText}>Save Location 💾</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  container: {
    width: '100%',
    maxWidth: 720,
    height: 540,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    gap: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F2050',
  },
  subTitle: {
    fontSize: 11,
    color: '#64748B',
  },
  closeBtn: {
    padding: 6,
  },
  mapWrap: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#F8FAFC',
  },
  mobileMapFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  mobileMapText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
  },
  detectBtn: {
    position: 'absolute',
    top: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  detectText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.primary,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    gap: 12,
  },
  addressTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  addressValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F2050',
  },
  navBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#0F2050',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  navBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFF',
  },
  confirmBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#16A34A',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  confirmBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFF',
  },
});
