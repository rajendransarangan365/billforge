import React, { useState, useRef } from 'react';
import {
  View,
  TextInput,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
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
  const borderAnim = useRef(new Animated.Value(0)).current;

  const handleFocus = () => {
    setFocused(true);
    Animated.timing(borderAnim, {
      toValue: 1,
      duration: 160,
      useNativeDriver: false,
    }).start();
  };

  const handleBlur = () => {
    setFocused(false);
    Animated.timing(borderAnim, {
      toValue: 0,
      duration: 160,
      useNativeDriver: false,
    }).start();
  };

  const borderColor = borderAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [error ? Colors.danger : Colors.border, error ? Colors.danger : Colors.accent],
  });

  const wrapperStyle = [
    styles.inputWrapper,
    error ? styles.inputError : null,
    !editable && !readOnly ? styles.inputDisabled : null,
  ];

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
          style={[styles.inputWrapper, error && styles.inputError]}
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
      <Animated.View style={[wrapperStyle, { borderColor }]}>
        {icon ? (
          <Ionicons
            name={icon}
            size={17}
            color={focused ? Colors.accent : Colors.textTertiary}
            style={styles.icon}
          />
        ) : null}
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={Colors.textTertiary}
          keyboardType={keyboardType}
          multiline={multiline}
          numberOfLines={numberOfLines}
          editable={editable}
          style={[styles.input, multiline && styles.inputMultiline, inputStyle]}
          onFocus={handleFocus}
          onBlur={handleBlur}
        />
        {rightIcon ? (
          <TouchableOpacity onPress={onRightIconPress} style={styles.rightIconBtn}>
            <Ionicons name={rightIcon} size={17} color={Colors.textTertiary} />
          </TouchableOpacity>
        ) : null}
      </Animated.View>
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
    color: Colors.textSecondary,
    marginBottom: Spacing.xs + 2,
  },
  labelFocused: {
    color: Colors.accent,
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
    minHeight: 50,
    overflow: 'hidden', // Add overflow: 'hidden' to prevent placeholder bleedout on web/Android
  },
  inputError: {
    borderColor: Colors.danger,
    backgroundColor: Colors.dangerLight,
  },
  inputDisabled: {
    backgroundColor: Colors.divider,
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
    color: Colors.text,
    flex: 1,
    paddingVertical: Spacing.sm + 2,
    minWidth: 0, // Ensure the native input shrinks correctly in flexboxes
    width: '100%',
  },
  inputMultiline: {
    textAlignVertical: 'top',
    minHeight: 88,
    paddingTop: Spacing.md,
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
