import { useColorScheme } from 'react-native';

import {
  ColorPalette,
  darkColors,
  layout,
  lightColors,
  radii,
  spacing,
  typography,
} from '@/theme/tokens';

export interface AppTheme {
  isDark: boolean;
  colors: ColorPalette;
  spacing: typeof spacing;
  radii: typeof radii;
  typography: typeof typography;
  layout: typeof layout;
}

/**
 * Provides strongly-typed design tokens following the system light/dark setting.
 * Defaults to dark mode when the OS reports null/unspecified so low-end OLED/LCD screens stay comfortable.
 */
export function useAppTheme(): AppTheme {
  const systemScheme = useColorScheme();
  const isDark = systemScheme !== 'light';

  return {
    isDark,
    colors: isDark ? darkColors : lightColors,
    spacing,
    radii,
    typography,
    layout,
  };
}
