import { Platform } from 'react-native';

export interface ColorPalette {
  background: string;
  surface: string;
  surfaceElevated: string;
  surfaceHero: string;
  surfaceBanner: string;
  surfaceWarningBanner: string;
  surfaceDangerBanner: string;
  border: string;
  borderAccent: string;
  borderWarning: string;
  borderDanger: string;
  primary: string;
  primaryMuted: string;
  primaryTextOnColor: string;
  badgeGold: string;
  badgeGoldText: string;
  danger: string;
  dangerMuted: string;
  warning: string;
  neutralBadge: string;
  neutralBarTrack: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  overlay: string;
}

export const darkColors: ColorPalette = {
  background: '#0B0E11',
  surface: '#151A21',
  surfaceElevated: '#1C222B',
  surfaceHero: '#0D261C',
  surfaceBanner: '#0E291E',
  surfaceWarningBanner: '#2B220B',
  surfaceDangerBanner: '#2C1215',
  border: '#232A34',
  borderAccent: '#194D37',
  borderWarning: '#6B5314',
  borderDanger: '#6E2228',
  primary: '#10B981',
  primaryMuted: '#0E3A2A',
  primaryTextOnColor: '#051B11',
  badgeGold: '#ECC94B',
  badgeGoldText: '#1A1605',
  danger: '#EF4444',
  dangerMuted: '#3B181C',
  warning: '#F59E0B',
  neutralBadge: '#525B68',
  neutralBarTrack: '#28303D',
  textPrimary: '#F3F5F7',
  textSecondary: '#9BA3AE',
  textMuted: '#68707C',
  overlay: 'rgba(0, 0, 0, 0.72)',
};

export const lightColors: ColorPalette = {
  background: '#F4F6F8',
  surface: '#FFFFFF',
  surfaceElevated: '#EEF2F6',
  surfaceHero: '#E6F5EE',
  surfaceBanner: '#E3F6EC',
  surfaceWarningBanner: '#FEF3C7',
  surfaceDangerBanner: '#FEE2E2',
  border: '#DCE2EA',
  borderAccent: '#A3DFC1',
  borderWarning: '#FCD34D',
  borderDanger: '#FCA5A5',
  primary: '#059669',
  primaryMuted: '#D1FAE5',
  primaryTextOnColor: '#FFFFFF',
  badgeGold: '#ECC94B',
  badgeGoldText: '#1A1605',
  danger: '#DC2626',
  dangerMuted: '#FEE2E2',
  warning: '#D97706',
  neutralBadge: '#64748B',
  neutralBarTrack: '#E2E8F0',
  textPrimary: '#0F172A',
  textSecondary: '#475569',
  textMuted: '#64748B',
  overlay: 'rgba(15, 23, 42, 0.55)',
};

export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

export const radii = {
  xs: 6,
  sm: 8,
  banner: 12,
  card: 16,
  pill: 999,
} as const;

export const typography = {
  fontFamily: Platform.select({
    ios: 'System',
    android: 'sans-serif',
    default: 'System',
  }),
  sizes: {
    badge: 11,
    caption: 12,
    body: 14,
    bodyStrong: 15,
    sectionTitle: 16,
    statValue: 19,
    screenTitle: 20,
    brandTitle: 26,
  },
  lineHeights: {
    badge: 14,
    caption: 16,
    body: 20,
    bodyStrong: 20,
    sectionTitle: 22,
    statValue: 24,
    screenTitle: 26,
    brandTitle: 32,
  },
  weights: {
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
  },
} as const;

export const layout = {
  minTouchTarget: 44,
  progressBarHeight: 10,
  stackedBarHeight: 10,
  badgeCircleSize: 28,
  crestSizeSmall: 36,
  crestSizeLarge: 60,
  tabCapsuleWidth: 64,
  tabCapsuleHeight: 32,
  borderWidth: 1,
} as const;
