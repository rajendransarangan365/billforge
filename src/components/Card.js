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
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 6,
    elevation: 2,
  },
  elevated: {
    shadowColor: Colors.shadowMedium,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 1,
    shadowRadius: 14,
    elevation: 5,
  },
  outlined: {
    shadowOpacity: 0,
    elevation: 0,
    borderWidth: 1,
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
