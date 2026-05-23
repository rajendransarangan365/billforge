import React from 'react';
import {
  TouchableOpacity,
  TouchableNativeFeedback,
  StyleSheet,
  View,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, BorderRadius } from '../theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * FAB – Floating Action Button
 *
 * Props:
 *   icon       – Ionicons name string (default: "add")
 *   onPress    – function
 *   color      – icon color (default: white)
 *   bgColor    – background color (default: Colors.accent)
 *   style      – ViewStyle override
 *   bottom     – override bottom offset (px)
 */
export function FAB({ icon = 'add', onPress, style, color, bgColor, bottom }) {
  const insets = useSafeAreaInsets();
  // Sit 16px above the bottom safe area (above gesture nav bar)
  const bottomOffset = bottom !== undefined ? bottom : 20 + insets.bottom;
  const bg = bgColor || Colors.accent;

  const fabStyle = [styles.fab, { bottom: bottomOffset, backgroundColor: bg }, style];

  if (Platform.OS === 'android') {
    return (
      <View style={[fabStyle, { overflow: 'hidden' }]}>
        <TouchableNativeFeedback
          onPress={onPress}
          background={TouchableNativeFeedback.Ripple('rgba(255,255,255,0.28)', false)}
        >
          <View style={styles.inner}>
            <Ionicons name={icon} size={26} color={color || Colors.textOnPrimary} />
          </View>
        </TouchableNativeFeedback>
      </View>
    );
  }

  return (
    <TouchableOpacity
      style={fabStyle}
      onPress={onPress}
      activeOpacity={0.82}
    >
      <Ionicons name={icon} size={26} color={color || Colors.textOnPrimary} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: 20,
    width: 58,
    height: 58,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.shadowDeep,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 8,
  },
  inner: {
    width: 58,
    height: 58,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
