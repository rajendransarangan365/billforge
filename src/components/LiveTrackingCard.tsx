// @ts-nocheck
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../theme';

export interface TrackingOrder {
  id: string | number;
  customer_name: string;
  customer_phone?: string;
  quarry_name: string;
  quarry_location?: string;
  material: string;
  quantity: string | number;
  total_amount?: number;
  driver_name?: string;
  driver_phone?: string;
  vehicle_no?: string;
  status: 'submitted' | 'assigned' | 'loaded' | 'in_transit' | 'delivered';
  created_at?: string;
  quarry_lat?: number;
  quarry_lng?: number;
  delivery_lat?: number;
  delivery_lng?: number;
  delivery_address?: string;
}

interface Props {
  order: TrackingOrder;
  onOpenMap?: () => void;
  onOpenChat?: () => void;
}

const STAGES = [
  { key: 'submitted', label: 'Enquiry Received', icon: 'clipboard-outline' },
  { key: 'assigned', label: 'Driver Assigned', icon: 'car-sport-outline' },
  { key: 'loaded', label: 'Material Loaded', icon: 'cube-outline' },
  { key: 'in_transit', label: 'Live In-Transit', icon: 'navigate-outline' },
  { key: 'delivered', label: 'Delivered', icon: 'checkmark-circle-outline' },
];

export function LiveTrackingCard({ order, onOpenMap, onOpenChat }: Props) {
  const currentStageIndex = STAGES.findIndex(s => s.key === order.status);
  const activeIndex = currentStageIndex >= 0 ? currentStageIndex : 0;

  const handleCallDriver = () => {
    if (order.driver_phone) {
      Linking.openURL(`tel:${order.driver_phone}`);
    }
  };

  const handleCallCustomer = () => {
    if (order.customer_phone) {
      Linking.openURL(`tel:${order.customer_phone}`);
    }
  };

  return (
    <View style={styles.card}>
      {/* Top Banner */}
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={styles.badgeIcon}>
            <Ionicons name="location" size={18} color="#E65100" />
          </View>
          <View>
            <Text style={styles.materialTitle}>{order.material || 'Construction Aggregate'}</Text>
            <Text style={styles.orderSubtitle}>
              Order #{order.id} • {order.quantity || 1} Tons • {order.quarry_name || 'Quarry Yard'}
            </Text>
          </View>
        </View>

        <View style={[styles.statusTag, order.status === 'delivered' ? styles.statusDelivered : styles.statusActive]}>
          <Ionicons
            name={order.status === 'delivered' ? 'checkmark-circle' : 'time'}
            size={14}
            color={order.status === 'delivered' ? '#16A34A' : '#E65100'}
          />
          <Text style={[styles.statusText, { color: order.status === 'delivered' ? '#16A34A' : '#E65100' }]}>
            {order.status === 'delivered' ? 'DELIVERED' : order.status === 'in_transit' ? 'IN TRANSIT' : 'PROCESSING'}
          </Text>
        </View>
      </View>

      {/* Swiggy-style Stepper Bar */}
      <View style={styles.stepperContainer}>
        {STAGES.map((stage, idx) => {
          const isDone = idx <= activeIndex;
          const isCurrent = idx === activeIndex;

          return (
            <View key={stage.key} style={styles.stepCol}>
              <View style={styles.stepLineWrap}>
                {idx > 0 && (
                  <View style={[styles.lineLeft, idx <= activeIndex ? styles.lineDone : styles.linePending]} />
                )}
                <View style={[styles.circle, isDone ? styles.circleDone : styles.circlePending, isCurrent && styles.circleCurrent]}>
                  <Ionicons name={stage.icon as any} size={14} color={isDone ? '#FFF' : Colors.textDisabled} />
                </View>
                {idx < STAGES.length - 1 && (
                  <View style={[styles.lineRight, idx < activeIndex ? styles.lineDone : styles.linePending]} />
                )}
              </View>
              <Text style={[styles.stepLabel, isDone && styles.stepLabelDone, isCurrent && styles.stepLabelCurrent]}>
                {stage.label}
              </Text>
            </View>
          );
        })}
      </View>

      {/* Driver & Transport Info Bar */}
      <View style={styles.driverBar}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
          <View style={styles.driverAvatar}>
            <Ionicons name="person" size={18} color="#0F2050" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.driverName}>{order.driver_name || 'Driver Unassigned'}</Text>
            <Text style={styles.vehicleNo}>Vehicle: {order.vehicle_no || 'TN 38 AB 1234'}</Text>
          </View>
        </View>

        <View style={{ flexDirection: 'row', gap: 8 }}>
          {order.driver_phone ? (
            <TouchableOpacity style={styles.iconBtnCall} onPress={handleCallDriver}>
              <Ionicons name="call" size={16} color="#FFF" />
              <Text style={styles.btnCallText}>Call Driver</Text>
            </TouchableOpacity>
          ) : null}

          {onOpenChat ? (
            <TouchableOpacity style={styles.iconBtnChat} onPress={onOpenChat}>
              <Ionicons name="chatbubbles" size={16} color={Colors.primary} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {/* Delivery Address & Map Trigger */}
      <View style={styles.footerRow}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
          <Ionicons name="pin" size={16} color={Colors.primary} />
          <Text style={styles.addressText} numberOfLines={1}>
            {order.delivery_address || 'Delivery Location Pin Set'}
          </Text>
        </View>

        {onOpenMap ? (
          <TouchableOpacity style={styles.mapBtn} onPress={onOpenMap}>
            <Ionicons name="map-outline" size={16} color="#FFF" />
            <Text style={styles.mapBtnText}>Live GPS Map</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  badgeIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFF3E0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  materialTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F2050',
  },
  orderSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  statusTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  statusActive: {
    backgroundColor: '#FFF3E0',
  },
  statusDelivered: {
    backgroundColor: '#DCFCE7',
  },
  statusText: {
    fontSize: 11,
    fontWeight: '800',
  },
  stepperContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 16,
  },
  stepCol: {
    flex: 1,
    alignItems: 'center',
  },
  stepLineWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    justifyContent: 'center',
    height: 24,
  },
  circle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  circlePending: {
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  circleDone: {
    backgroundColor: '#16A34A',
  },
  circleCurrent: {
    backgroundColor: '#E65100',
    transform: [{ scale: 1.15 }],
  },
  lineLeft: {
    flex: 1,
    height: 3,
  },
  lineRight: {
    flex: 1,
    height: 3,
  },
  linePending: {
    backgroundColor: '#E2E8F0',
  },
  lineDone: {
    backgroundColor: '#16A34A',
  },
  stepLabel: {
    fontSize: 9,
    fontWeight: '600',
    color: '#94A3B8',
    marginTop: 6,
    textAlign: 'center',
  },
  stepLabelDone: {
    color: '#0F172A',
  },
  stepLabelCurrent: {
    color: '#E65100',
    fontWeight: '800',
  },
  driverBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    padding: 10,
    borderRadius: 10,
    marginVertical: 8,
  },
  driverAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  driverName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F2050',
  },
  vehicleNo: {
    fontSize: 11,
    color: '#64748B',
  },
  iconBtnCall: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#16A34A',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  btnCallText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFF',
  },
  iconBtnChat: {
    backgroundColor: Colors.primarySurface,
    borderWidth: 1,
    borderColor: Colors.primaryBorder,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
    gap: 8,
  },
  addressText: {
    fontSize: 12,
    color: '#334155',
    fontWeight: '500',
  },
  mapBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#0F2050',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  mapBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFF',
  },
});
