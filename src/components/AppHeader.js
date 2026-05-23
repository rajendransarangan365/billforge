import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Platform,
  TouchableOpacity,
  TouchableNativeFeedback,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing } from '../theme';

/**
 * AppHeader – reusable screen header with safe-area top padding, gradient look,
 * optional back button, title/subtitle, and right action slot.
 *
 * Props:
 *   title       – string
 *   subtitle    – string (optional)
 *   onBack      – function (optional; renders back button when provided)
 *   rightAction – React element (optional)
 *   style       – ViewStyle override
 *   light       – bool: white text (for dark/gradient bg)
 */
export function AppHeader({ title, subtitle, onBack, rightAction, style, light = false }) {
  const insets = useSafeAreaInsets();
  const textColor = light ? Colors.textOnPrimary : Colors.text;
  const subColor = light ? 'rgba(255,255,255,0.72)' : Colors.textTertiary;
  const iconColor = light ? Colors.textOnPrimary : Colors.text;

  const BackButton = () => {
    if (Platform.OS === 'android') {
      return (
        <TouchableNativeFeedback
          onPress={onBack}
          background={TouchableNativeFeedback.Ripple('rgba(255,255,255,0.2)', true, 22)}
        >
          <View style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={iconColor} />
          </View>
        </TouchableNativeFeedback>
      );
    }
    return (
      <TouchableOpacity style={styles.backBtn} onPress={onBack} activeOpacity={0.7}>
        <Ionicons name="chevron-back" size={24} color={iconColor} />
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }, style]}>
      <View style={styles.row}>
        {onBack ? <BackButton /> : <View style={styles.backBtn} />}

        <View style={styles.titleArea}>
          <Text style={[styles.title, { color: textColor }]} numberOfLines={1}>
            {title}
          </Text>
          {subtitle ? (
            <Text style={[styles.subtitle, { color: subColor }]} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>

        <View style={styles.right}>{rightAction || <View style={{ width: 40 }} />}</View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.sm + 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleArea: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: Spacing.xs,
  },
  title: {
    ...Typography.h3,
    textAlign: 'center',
  },
  subtitle: {
    ...Typography.small,
    textAlign: 'center',
    marginTop: 1,
  },
  right: {
    width: 40,
    alignItems: 'flex-end',
  },
});
