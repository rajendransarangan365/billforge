// @ts-nocheck
import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, TouchableOpacity, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export interface ToastMessage {
  id: string;
  type?: 'success' | 'error' | 'info' | 'warning';
  title?: string;
  message: string;
  duration?: number;
}

interface ToastProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export function ToastContainer({ toasts, onDismiss }: ToastProps) {
  const insets = useSafeAreaInsets();
  if (!toasts || toasts.length === 0) return null;

  return (
    <View pointerEvents="box-none" style={[styles.container, { top: insets.top + 10 }]}>
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </View>
  );
}

function ToastItem({ toast, onDismiss }: { toast: ToastMessage; onDismiss: (id: string) => void }) {
  const translateY = useRef(new Animated.Value(-40)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        friction: 8,
        tension: 80,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();

    const timer = setTimeout(() => {
      dismiss();
    }, toast.duration || 3500);

    return () => clearTimeout(timer);
  }, []);

  const dismiss = () => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: -30,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onDismiss(toast.id);
    });
  };

  const type = toast.type || 'success';
  const getTheme = () => {
    switch (type) {
      case 'success':
        return {
          bgColor: '#064E3B',
          borderColor: '#10B981',
          icon: 'checkmark-circle-sharp',
          iconColor: '#34D399',
          title: toast.title || 'Saved Successfully',
        };
      case 'error':
        return {
          bgColor: '#7F1D1D',
          borderColor: '#EF4444',
          icon: 'alert-circle-sharp',
          iconColor: '#F87171',
          title: toast.title || 'Action Failed',
        };
      case 'warning':
        return {
          bgColor: '#78350F',
          borderColor: '#F59E0B',
          icon: 'warning-sharp',
          iconColor: '#FBBF24',
          title: toast.title || 'Notice',
        };
      case 'info':
      default:
        return {
          bgColor: '#0F172A',
          borderColor: '#38BDF8',
          icon: 'information-circle-sharp',
          iconColor: '#38BDF8',
          title: toast.title || 'Notification',
        };
    }
  };

  const theme = getTheme();

  return (
    <Animated.View
      style={[
        styles.toastCard,
        {
          backgroundColor: theme.bgColor,
          borderColor: theme.borderColor,
          transform: [{ translateY }],
          opacity,
        },
      ]}
    >
      <View style={styles.iconWrap}>
        <Ionicons name={theme.icon} size={22} color={theme.iconColor} />
      </View>
      <View style={styles.textWrap}>
        <Text style={styles.toastTitle}>{theme.title}</Text>
        <Text style={styles.toastMessage}>{toast.message}</Text>
      </View>
      <TouchableOpacity style={styles.closeBtn} onPress={dismiss} activeOpacity={0.7}>
        <Ionicons name="close" size={16} color="#94A3B8" />
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 99999,
    alignItems: 'center',
    gap: 8,
  },
  toastCard: {
    width: '100%',
    maxWidth: 520,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    gap: 12,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.35,
        shadowRadius: 10,
      },
      android: {
        elevation: 8,
      },
      web: {
        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.4), 0 8px 10px -6px rgba(0, 0, 0, 0.3)',
      },
    }),
  },
  iconWrap: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  textWrap: {
    flex: 1,
  },
  toastTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  toastMessage: {
    fontSize: 12,
    color: '#E2E8F0',
    marginTop: 1,
    lineHeight: 16,
  },
  closeBtn: {
    padding: 4,
  },
});
