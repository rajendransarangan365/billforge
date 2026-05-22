import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, View } from 'react-native';
import { Colors, Typography, BorderRadius, Spacing } from '../theme';
import { Ionicons } from '@expo/vector-icons';

export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  icon,
  iconPosition = 'left',
  loading = false,
  disabled = false,
  style,
  textStyle,
  fullWidth = false,
}) {
  const buttonStyles = [
    styles.base,
    styles[variant],
    styles[`size_${size}`],
    fullWidth && styles.fullWidth,
    disabled && styles.disabled,
    style,
  ];

  const textStyles = [
    styles.text,
    styles[`text_${variant}`],
    styles[`text_${size}`],
    disabled && styles.textDisabled,
    textStyle,
  ];

  const iconColor = variant === 'primary' ? Colors.textOnPrimary :
    variant === 'accent' ? Colors.textOnAccent :
    variant === 'danger' ? Colors.surface :
    variant === 'outline' ? Colors.primary :
    variant === 'ghost' ? Colors.primary : Colors.textOnPrimary;

  const iconSize = size === 'sm' ? 16 : size === 'lg' ? 22 : 18;

  return (
    <TouchableOpacity
      style={buttonStyles}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.7}
    >
      {loading ? (
        <ActivityIndicator color={iconColor} size="small" />
      ) : (
        <View style={styles.content}>
          {icon && iconPosition === 'left' && (
            <Ionicons name={icon} size={iconSize} color={disabled ? Colors.textTertiary : iconColor} style={styles.iconLeft} />
          )}
          <Text style={textStyles}>{title}</Text>
          {icon && iconPosition === 'right' && (
            <Ionicons name={icon} size={iconSize} color={disabled ? Colors.textTertiary : iconColor} style={styles.iconRight} />
          )}
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullWidth: {
    width: '100%',
  },
  
  // Variants
  primary: {
    backgroundColor: Colors.primary,
  },
  secondary: {
    backgroundColor: Colors.secondary,
  },
  accent: {
    backgroundColor: Colors.accent,
  },
  danger: {
    backgroundColor: Colors.danger,
  },
  outline: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: Colors.primary,
  },
  ghost: {
    backgroundColor: 'transparent',
  },

  // Sizes
  size_sm: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    minHeight: 34,
  },
  size_md: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    minHeight: 44,
  },
  size_lg: {
    paddingHorizontal: Spacing.xxl,
    paddingVertical: Spacing.lg,
    minHeight: 52,
  },

  // Text
  text: {
    ...Typography.button,
  },
  text_primary: { color: Colors.textOnPrimary },
  text_secondary: { color: Colors.textOnPrimary },
  text_accent: { color: Colors.textOnAccent },
  text_danger: { color: Colors.surface },
  text_outline: { color: Colors.primary },
  text_ghost: { color: Colors.primary },
  text_sm: { ...Typography.buttonSmall },
  text_md: { ...Typography.button },
  text_lg: { ...Typography.button, fontSize: 17 },

  disabled: {
    opacity: 0.5,
  },
  textDisabled: {
    color: Colors.textTertiary,
  },
  iconLeft: {
    marginRight: Spacing.sm,
  },
  iconRight: {
    marginLeft: Spacing.sm,
  },
});
