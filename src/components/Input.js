import React, { useState } from 'react';
import { View, TextInput, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Colors, Typography, BorderRadius, Spacing } from '../theme';
import { Ionicons } from '@expo/vector-icons';

export function Input({
  label,
  value,
  onChangeText,
  placeholder,
  error,
  hint,
  keyboardType = 'default',
  multiline = false,
  numberOfLines = 1,
  editable = true,
  required = false,
  icon,
  rightIcon,
  onRightIconPress,
  style,
  inputStyle,
  onPress,
  readOnly = false,
}) {
  const [focused, setFocused] = useState(false);

  if (readOnly || onPress) {
    return (
      <View style={[styles.container, style]}>
        {label && (
          <Text style={styles.label}>
            {label}
            {required && <Text style={styles.required}> *</Text>}
          </Text>
        )}
        <TouchableOpacity
          style={[
            styles.inputWrapper,
            error && styles.inputError,
            !editable && styles.inputDisabled,
          ]}
          onPress={onPress}
          activeOpacity={0.7}
        >
          {icon && (
            <Ionicons name={icon} size={18} color={Colors.textTertiary} style={styles.icon} />
          )}
          <Text
            style={[
              styles.input,
              !value && styles.placeholder,
              inputStyle,
            ]}
            numberOfLines={1}
          >
            {value || placeholder || ''}
          </Text>
          {rightIcon && (
            <Ionicons name={rightIcon} size={18} color={Colors.textTertiary} />
          )}
        </TouchableOpacity>
        {error && <Text style={styles.error}>{error}</Text>}
        {hint && !error && <Text style={styles.hint}>{hint}</Text>}
      </View>
    );
  }

  return (
    <View style={[styles.container, style]}>
      {label && (
        <Text style={styles.label}>
          {label}
          {required && <Text style={styles.required}> *</Text>}
        </Text>
      )}
      <View style={[
        styles.inputWrapper,
        focused && styles.inputFocused,
        error && styles.inputError,
        !editable && styles.inputDisabled,
      ]}>
        {icon && (
          <Ionicons name={icon} size={18} color={focused ? Colors.primary : Colors.textTertiary} style={styles.icon} />
        )}
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={Colors.textTertiary}
          keyboardType={keyboardType}
          multiline={multiline}
          numberOfLines={numberOfLines}
          editable={editable}
          style={[
            styles.input,
            multiline && styles.inputMultiline,
            inputStyle,
          ]}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
        {rightIcon && (
          <TouchableOpacity onPress={onRightIconPress}>
            <Ionicons name={rightIcon} size={18} color={Colors.textTertiary} />
          </TouchableOpacity>
        )}
      </View>
      {error && <Text style={styles.error}>{error}</Text>}
      {hint && !error && <Text style={styles.hint}>{hint}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: Spacing.lg,
  },
  label: {
    ...Typography.captionMedium,
    color: Colors.text,
    marginBottom: Spacing.xs + 2,
  },
  required: {
    color: Colors.danger,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    minHeight: 46,
  },
  inputFocused: {
    borderColor: Colors.primary,
    backgroundColor: Colors.surface,
  },
  inputError: {
    borderColor: Colors.danger,
    backgroundColor: '#FFF5F5',
  },
  inputDisabled: {
    backgroundColor: Colors.divider,
    opacity: 0.7,
  },
  icon: {
    marginRight: Spacing.sm,
  },
  input: {
    ...Typography.body,
    color: Colors.text,
    flex: 1,
    paddingVertical: Spacing.sm + 2,
  },
  inputMultiline: {
    textAlignVertical: 'top',
    minHeight: 80,
  },
  placeholder: {
    color: Colors.textTertiary,
  },
  error: {
    ...Typography.small,
    color: Colors.danger,
    marginTop: Spacing.xs,
  },
  hint: {
    ...Typography.small,
    color: Colors.textTertiary,
    marginTop: Spacing.xs,
  },
});
