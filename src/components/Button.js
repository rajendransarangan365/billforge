import React from 'react';
import {
  TouchableOpacity,
  TouchableNativeFeedback,
  Text,
  StyleSheet,
  ActivityIndicator,
  View,
  Platform,
} from 'react-native';
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
  const isDisabled = disabled || loading;

  const containerStyles = [
    styles.base,
    styles[variant],
    styles[`size_${size}`],
    fullWidth && styles.fullWidth,
    isDisabled && styles.disabled,
    style,
  ];

  const textStyles = [
    styles.text,
    styles[`text_${variant}`],
    styles[`text_${size}`],
    isDisabled && styles.textDisabled,
    textStyle,
  ];

  const iconColor =
    variant === 'primary' ? Colors.textOnPrimary :
    variant === 'accent' ? Colors.textOnAccent :
    variant === 'danger' ? Colors.surface :
    variant === 'success' ? '#fff' :
    variant === 'outline' ? Colors.primary :
    variant === 'ghost' ? Colors.primary :
    Colors.textOnPrimary;

  const iconSize = size === 'sm' ? 15 : size === 'lg' ? 22 : 18;

  const inner = loading ? (
    <ActivityIndicator color={iconColor} size="small" />
  ) : (
    <View style={styles.content}>
      {icon && iconPosition === 'left' && (
        <Ionicons
          name={icon}
          size={iconSize}
          color={isDisabled ? Colors.textDisabled : iconColor}
          style={styles.iconLeft}
        />
      )}
      <Text style={textStyles}>{title}</Text>
      {icon && iconPosition === 'right' && (
        <Ionicons
          name={icon}
          size={iconSize}
          color={isDisabled ? Colors.textDisabled : iconColor}
          style={styles.iconRight}
        />
      )}
    </View>
  );

  if (Platform.OS === 'android' && !isDisabled && variant !== 'ghost') {
    const rippleColor =
      variant === 'outline' ? Colors.primarySurface :
      variant === 'primary' ? 'rgba(255,255,255,0.22)' :
      variant === 'accent' ? 'rgba(255,255,255,0.22)' :
      'rgba(0,0,0,0.1)';

    return (
      <TouchableNativeFeedback
        onPress={onPress}
        disabled={isDisabled}
        background={TouchableNativeFeedback.Ripple(rippleColor, false)}
      >
        <View style={containerStyles}>{inner}</View>
      </TouchableNativeFeedback>
    );
  }

  return (
    <TouchableOpacity
      style={containerStyles}
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.75}
    >
      {inner}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullWidth: { width: '100%' },

  // Variants
  primary: { backgroundColor: Colors.primary },
  secondary: { backgroundColor: Colors.primaryMid },
  accent: { backgroundColor: Colors.accent },
  danger: { backgroundColor: Colors.danger },
  success: { backgroundColor: Colors.success },
  outline: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: Colors.primary,
  },
  ghost: { backgroundColor: 'transparent' },

  // Sizes
  size_sm: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    minHeight: 36,
    borderRadius: BorderRadius.sm,
  },
  size_md: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    minHeight: 48,
    borderRadius: BorderRadius.md,
  },
  size_lg: {
    paddingHorizontal: Spacing.xxl,
    paddingVertical: Spacing.lg,
    minHeight: 54,
    borderRadius: BorderRadius.lg,
  },

  // Text
  text: { ...Typography.button },
  text_primary: { color: Colors.textOnPrimary },
  text_secondary: { color: Colors.textOnPrimary },
  text_accent: { color: Colors.textOnAccent },
  text_danger: { color: '#fff' },
  text_success: { color: '#fff' },
  text_outline: { color: Colors.primary },
  text_ghost: { color: Colors.primary },
  text_sm: { ...Typography.buttonSmall },
  text_md: { ...Typography.button },
  text_lg: { ...Typography.button, fontSize: 16 },

  disabled: { opacity: 0.45 },
  textDisabled: { color: Colors.textDisabled },
  iconLeft: { marginRight: Spacing.sm },
  iconRight: { marginLeft: Spacing.sm },
});
