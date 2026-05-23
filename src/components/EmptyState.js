import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius } from '../theme';

export function EmptyState({ icon, title, message, children }) {
  return (
    <View style={styles.container}>
      <View style={styles.iconWrap}>
        <View style={styles.iconCircleOuter}>
          <View style={styles.iconCircleInner}>
            <Ionicons
              name={icon || 'document-text-outline'}
              size={36}
              color={Colors.primaryLight}
            />
          </View>
        </View>
      </View>
      <Text style={styles.title}>{title}</Text>
      {message ? <Text style={styles.message}>{message}</Text> : null}
      {children ? <View style={styles.actions}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xxxl,
    paddingVertical: Spacing.section,
  },
  iconWrap: {
    marginBottom: Spacing.xl,
  },
  iconCircleOuter: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: Colors.primarySurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircleInner: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.accentSurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    ...Typography.h3,
    color: Colors.text,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  message: {
    ...Typography.body,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  actions: {
    marginTop: Spacing.xxl,
    width: '100%',
    alignItems: 'center',
  },
});
