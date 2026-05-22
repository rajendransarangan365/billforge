import { Platform } from 'react-native';

const fontFamily = Platform.select({
  ios: 'System',
  android: 'Roboto',
  default: 'System',
});

export const Typography = {
  hero: {
    fontSize: 32,
    fontWeight: '700',
    lineHeight: 40,
    letterSpacing: -0.5,
    fontFamily,
  },
  h1: {
    fontSize: 26,
    fontWeight: '700',
    lineHeight: 34,
    letterSpacing: -0.3,
    fontFamily,
  },
  h2: {
    fontSize: 22,
    fontWeight: '600',
    lineHeight: 28,
    letterSpacing: -0.2,
    fontFamily,
  },
  h3: {
    fontSize: 18,
    fontWeight: '600',
    lineHeight: 24,
    fontFamily,
  },
  body: {
    fontSize: 15,
    fontWeight: '400',
    lineHeight: 22,
    fontFamily,
  },
  bodyMedium: {
    fontSize: 15,
    fontWeight: '500',
    lineHeight: 22,
    fontFamily,
  },
  bodySemibold: {
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 22,
    fontFamily,
  },
  caption: {
    fontSize: 13,
    fontWeight: '400',
    lineHeight: 18,
    fontFamily,
  },
  captionMedium: {
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
    fontFamily,
  },
  small: {
    fontSize: 11,
    fontWeight: '400',
    lineHeight: 16,
    fontFamily,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    fontFamily,
  },
  button: {
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 20,
    letterSpacing: 0.3,
    fontFamily,
  },
  buttonSmall: {
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
    letterSpacing: 0.3,
    fontFamily,
  },
  tabular: {
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 20,
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
  sm: 6,
  md: 10,
  lg: 14,
  xl: 18,
  full: 9999,
};
