import React, { useState } from 'react';
import {
  View,
  TextInput,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
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

  const wrapperBorderColor = error
    ? Colors.danger
    : focused
    ? Colors.primary
    : 'rgba(255, 255, 255, 0.12)';

  const wrapperBg = error
    ? 'rgba(251, 113, 133, 0.15)'
    : focused
    ? 'rgba(30, 41, 59, 0.9)'
    : 'rgba(30, 41, 59, 0.6)';

  if (readOnly || onPress) {
    return (
      <View style={[styles.container, style]}>
        {label ? (
          <Text style={styles.label}>
            {label}
            {required ? <Text style={styles.required}> *</Text> : null}
          </Text>
        ) : null}
        <TouchableOpacity
          style={[styles.inputWrapper, { borderColor: wrapperBorderColor, backgroundColor: wrapperBg }]}
          onPress={onPress}
          activeOpacity={0.7}
        >
          {icon ? (
            <Ionicons name={icon} size={17} color={Colors.textTertiary} style={styles.icon} />
          ) : null}
          <Text
            style={[styles.input, !value && styles.placeholder, inputStyle]}
            numberOfLines={1}
          >
            {value || placeholder || ''}
          </Text>
          {rightIcon ? (
            <Ionicons name={rightIcon} size={17} color={Colors.textTertiary} />
          ) : null}
        </TouchableOpacity>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {hint && !error ? <Text style={styles.hint}>{hint}</Text> : null}
      </View>
    );
  }

  return (
    <View style={[styles.container, style]}>
      {label ? (
        <Text style={[styles.label, focused && styles.labelFocused]}>
          {label}
          {required ? <Text style={styles.required}> *</Text> : null}
        </Text>
      ) : null}
      <View style={[styles.inputWrapper, { borderColor: wrapperBorderColor, backgroundColor: wrapperBg }, !editable && styles.inputDisabled]}>
        {icon ? (
          <Ionicons
            name={icon}
            size={17}
            color={focused ? Colors.primary : Colors.textTertiary}
            style={styles.icon}
          />
        ) : null}
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="#64748B"
          keyboardType={keyboardType}
          multiline={multiline}
          numberOfLines={numberOfLines}
          editable={editable}
          style={[styles.input, multiline && styles.inputMultiline, inputStyle]}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
        {rightIcon ? (
          <TouchableOpacity onPress={onRightIconPress} style={styles.rightIconBtn}>
            <Ionicons name={rightIcon} size={17} color={Colors.textTertiary} />
          </TouchableOpacity>
        ) : null}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {hint && !error ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: Spacing.lg,
  },
  label: {
    ...Typography.captionSemibold,
    color: '#94A3B8',
    marginBottom: Spacing.xs + 2,
    fontSize: 12,
    letterSpacing: 0.2,
  },
  labelFocused: {
    color: '#818CF8',
  },
  required: {
    color: Colors.danger,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.md,
    minHeight: 52,
  },
  inputDisabled: {
    opacity: 0.6,
  },
  icon: {
    marginRight: Spacing.sm,
  },
  rightIconBtn: {
    padding: Spacing.xs,
    marginLeft: Spacing.xs,
  },
  input: {
    ...Typography.body,
    color: '#F8FAFC',
    flex: 1,
    paddingVertical: Spacing.sm + 2,
    minWidth: 0,
    width: '100%',
  },
  inputMultiline: {
    textAlignVertical: 'top',
    minHeight: 88,
    paddingTop: Spacing.md,
  },
  placeholder: {
    color: '#64748B',
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
