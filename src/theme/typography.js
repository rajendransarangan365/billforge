import { Platform, PixelRatio } from 'react-native';

const fontFamily = Platform.select({
  ios: 'System',
  android: 'Roboto',
  default: 'System',
});

// Scale font sizes for very high-DPI screens
const fontScale = Math.min(PixelRatio.getFontScale(), 1.15);
const fs = (size) => Math.round(size / fontScale);

export const Typography = {
  hero: {
    fontSize: fs(32),
    fontWeight: '800',
    lineHeight: fs(40),
    letterSpacing: -0.8,
    fontFamily,
  },
  h1: {
    fontSize: fs(24),
    fontWeight: '700',
    lineHeight: fs(32),
    letterSpacing: -0.4,
    fontFamily,
  },
  h2: {
    fontSize: fs(20),
    fontWeight: '700',
    lineHeight: fs(28),
    letterSpacing: -0.2,
    fontFamily,
  },
  h3: {
    fontSize: fs(17),
    fontWeight: '600',
    lineHeight: fs(24),
    letterSpacing: -0.1,
    fontFamily,
  },
  body: {
    fontSize: fs(15),
    fontWeight: '400',
    lineHeight: fs(22),
    fontFamily,
  },
  bodyMedium: {
    fontSize: fs(15),
    fontWeight: '500',
    lineHeight: fs(22),
    fontFamily,
  },
  bodySemibold: {
    fontSize: fs(15),
    fontWeight: '600',
    lineHeight: fs(22),
    fontFamily,
  },
  caption: {
    fontSize: fs(13),
    fontWeight: '400',
    lineHeight: fs(18),
    fontFamily,
  },
  captionMedium: {
    fontSize: fs(13),
    fontWeight: '500',
    lineHeight: fs(18),
    fontFamily,
  },
  captionSemibold: {
    fontSize: fs(13),
    fontWeight: '600',
    lineHeight: fs(18),
    fontFamily,
  },
  small: {
    fontSize: fs(11),
    fontWeight: '400',
    lineHeight: fs(16),
    fontFamily,
  },
  label: {
    fontSize: fs(11),
    fontWeight: '700',
    lineHeight: fs(16),
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    fontFamily,
  },
  button: {
    fontSize: fs(15),
    fontWeight: '700',
    lineHeight: fs(20),
    letterSpacing: 0.2,
    fontFamily,
  },
  buttonSmall: {
    fontSize: fs(13),
    fontWeight: '600',
    lineHeight: fs(18),
    letterSpacing: 0.1,
    fontFamily,
  },
  tabular: {
    fontSize: fs(14),
    fontWeight: '500',
    lineHeight: fs(20),
    fontVariant: ['tabular-nums'],
    fontFamily,
  },
  currency: {
    fontSize: fs(18),
    fontWeight: '700',
    lineHeight: fs(24),
    letterSpacing: -0.3,
    fontVariant: ['tabular-nums'],
    fontFamily,
  },
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  section: 40,
};

export const BorderRadius = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  full: 9999,
};
