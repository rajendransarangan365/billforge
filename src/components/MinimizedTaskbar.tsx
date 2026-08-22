// @ts-nocheck
import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../theme';
import { useAuth } from '../context/AuthContext';
import { getMinimizedDrafts, clearDraft } from '../database/db';

export function MinimizedTaskbar() {
  const router = useRouter();
  const { quarryId, isOwner } = useAuth();
  const activeQuarryId = quarryId || 1;
  const [minimizedDrafts, setMinimizedDrafts] = useState<any[]>([]);

  const loadDrafts = useCallback(async () => {
    try {
      const list = await getMinimizedDrafts(activeQuarryId);
      setMinimizedDrafts(list);
    } catch (e) {}
  }, [activeQuarryId]);


  useEffect(() => {
    loadDrafts();
    const timer = setInterval(loadDrafts, 3000);
    return () => clearInterval(timer);
  }, [loadDrafts]);

  if (minimizedDrafts.length === 0) return null;

  const handleResume = (draft: any) => {
    router.push(`/bill-form/${draft.templateId || 1}`);
  };

  const handleClose = async (draft: any, e: any) => {
    e.stopPropagation();
    await clearDraft(draft.templateId, activeQuarryId);
    loadDrafts();
  };

  return (
    <View style={styles.taskbarRoot}>
      <Text style={styles.taskbarLabel}>Minimized Taskbar:</Text>
      <View style={styles.pillsContainer}>
        {minimizedDrafts.map((d, i) => {
          const hData = d.data?.headerData || {};
          const bn = hData.BN || hData.billnumber || `#${i + 1}`;
          const cust = d.data?.customerName || hData.partyname || hData.customername || 'Unsaved Bill';
          return (
            <TouchableOpacity
              key={d.templateId || i}
              style={styles.pill}
              onPress={() => handleResume(d)}
              activeOpacity={0.8}
            >
              <Ionicons name="document-text" size={14} color={Colors.primary} />
              <Text style={styles.pillText} numberOfLines={1}>
                {bn} - {cust} (Minimized)
              </Text>
              <TouchableOpacity style={styles.closeBtn} onPress={(e) => handleClose(d, e)}>
                <Ionicons name="close-circle" size={16} color={Colors.textTertiary} />
              </TouchableOpacity>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  taskbarRoot: {
    position: 'absolute',
    bottom: Platform.OS === 'web' ? 12 : 60,
    left: 20,
    right: 20,
    backgroundColor: '#0F172A',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    zIndex: 9999,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 10,
  },
  taskbarLabel: { fontSize: 11, fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.8 },
  pillsContainer: { flex: 1, flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 6,
    borderWidth: 1,
    borderColor: '#334155',
  },
  pillText: { fontSize: 12, fontWeight: '600', color: '#F8FAFC', maxWidth: 200 },
  closeBtn: { padding: 2 },
});
