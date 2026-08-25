import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Colors, BorderRadius, Spacing } from '../theme';

/**
 * Card – surface container with shadow and optional variants.
 *
 * Variants:
 *   default   – white card with subtle shadow
 *   elevated  – deeper shadow
 *   outlined  – border only, no shadow
 *   tinted    – light-tinted background (uses borderColor as tint key)
 */
export function Card({ children, style, variant = 'default', noPadding = false }) {
  return (
    <View
      style={[
        styles.card,
        variant === 'elevated' && styles.elevated,
        variant === 'outlined' && styles.outlined,
        variant === 'tinted' && styles.tinted,
        noPadding && styles.noPadding,
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg + 2,
    padding: Spacing.xl,
    shadowColor: 'rgba(0, 0, 0, 0.5)',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 1,
    shadowRadius: 24,
    elevation: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  elevated: {
    shadowColor: 'rgba(15, 32, 80, 0.10)',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 1,
    shadowRadius: 36,
    elevation: 8,
    borderWidth: 0,
  },
  outlined: {
    shadowOpacity: 0,
    elevation: 0,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  tinted: {
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    shadowOpacity: 0,
    elevation: 0,
  },
  noPadding: {
    padding: 0,
  },
});
