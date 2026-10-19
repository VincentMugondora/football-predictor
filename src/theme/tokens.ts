import { Platform } from 'react-native';

export interface ColorPalette {
  background: string;
  pitchStripe: string;
  surface: string;
  surfaceElevated: string;
  surfaceHero: string;
  surfaceDayPill: string;
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
  background: '#052617',
  pitchStripe: '#072E1C',
  surface: '#0A3320',
  surfaceElevated: '#0F4029',
  surfaceHero: '#0B3622',
  surfaceDayPill: '#0E3925',
  surfaceBanner: '#0D3B25',
  surfaceWarningBanner: '#2B220B',
  surfaceDangerBanner: '#2C1215',
  border: '#194D33',
  borderAccent: '#256B48',
  borderWarning: '#6B5314',
  borderDanger: '#6E2228',
  primary: '#D4E137',
  primaryMuted: '#1E4628',
  primaryTextOnColor: '#071F12',
  badgeGold: '#CCA043',
  badgeGoldText: '#141B0B',
  danger: '#EF4444',
  dangerMuted: '#3B181C',
  warning: '#F59E0B',
  neutralBadge: '#4A6B58',
  neutralBarTrack: '#14422C',
  textPrimary: '#F3F7F4',
  textSecondary: '#A8C2B3',
  textMuted: '#759684',
  overlay: 'rgba(2, 18, 10, 0.78)',
};

export const lightColors: ColorPalette = {
  background: '#052617',
  pitchStripe: '#072E1C',
  surface: '#0A3320',
  surfaceElevated: '#0F4029',
  surfaceHero: '#0B3622',
  surfaceDayPill: '#0E3925',
  surfaceBanner: '#0D3B25',
  surfaceWarningBanner: '#2B220B',
  surfaceDangerBanner: '#2C1215',
  border: '#194D33',
  borderAccent: '#256B48',
  borderWarning: '#6B5314',
  borderDanger: '#6E2228',
  primary: '#D4E137',
  primaryMuted: '#1E4628',
  primaryTextOnColor: '#071F12',
  badgeGold: '#CCA043',
  badgeGoldText: '#141B0B',
  danger: '#EF4444',
  dangerMuted: '#3B181C',
  warning: '#F59E0B',
  neutralBadge: '#4A6B58',
  neutralBarTrack: '#14422C',
  textPrimary: '#F3F7F4',
  textSecondary: '#A8C2B3',
  textMuted: '#759684',
  overlay: 'rgba(2, 18, 10, 0.78)',
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
    bodyStrong: 16,
    sectionTitle: 16,
    statValue: 19,
    screenTitle: 20,
    fixtureTime: 24,
    brandTitle: 28,
    heroTime: 46,
  },
  lineHeights: {
    badge: 14,
    caption: 16,
    body: 20,
    bodyStrong: 22,
    sectionTitle: 22,
    statValue: 24,
    screenTitle: 26,
    fixtureTime: 28,
    brandTitle: 34,
    heroTime: 52,
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
  crestSizeSmall: 28,
  crestSizeLarge: 72,
  tabCapsuleWidth: 64,
  tabCapsuleHeight: 34,
  borderWidth: 1,
} as const;
