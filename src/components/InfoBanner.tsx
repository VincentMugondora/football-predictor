import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AppTheme, useAppTheme } from '@/theme/useAppTheme';

export type InfoBannerTone = 'info' | 'warning' | 'danger';

export interface InfoBannerProps {
  title: string;
  subtitle?: string;
  tone?: InfoBannerTone;
}

export function InfoBanner({ title, subtitle, tone = 'info' }: InfoBannerProps) {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme, tone), [theme, tone]);

  const iconSymbol = tone === 'danger' ? '!' : tone === 'warning' ? '!' : 'i';

  return (
    <View
      style={styles.banner}
      accessible={true}
      accessibilityRole="alert"
      accessibilityLabel={subtitle ? `${title}. ${subtitle}` : title}>
      <View style={styles.iconCircle}>
        <Text style={styles.iconText}>{iconSymbol}</Text>
      </View>
      <View style={styles.content}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
    </View>
  );
}

function createStyles(theme: AppTheme, tone: InfoBannerTone) {
  let bg = theme.colors.surfaceBanner;
  let border = theme.colors.borderAccent;
  let accent = theme.colors.primary;

  if (tone === 'warning') {
    bg = theme.colors.surfaceWarningBanner;
    border = theme.colors.borderWarning;
    accent = theme.colors.badgeGold;
  } else if (tone === 'danger') {
    bg = theme.colors.surfaceDangerBanner;
    border = theme.colors.borderDanger;
    accent = theme.colors.danger;
  }

  return StyleSheet.create({
    banner: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: bg,
      borderColor: border,
      borderWidth: theme.layout.borderWidth,
      borderRadius: theme.radii.banner,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.md,
      gap: theme.spacing.md,
    },
    iconCircle: {
      width: 24,
      height: 24,
      borderRadius: theme.radii.pill,
      borderColor: accent,
      borderWidth: 2,
      alignItems: 'center',
      justifyContent: 'center',
    },
    iconText: {
      color: accent,
      fontSize: theme.typography.sizes.caption,
      fontWeight: theme.typography.weights.bold,
    },
    content: {
      flex: 1,
      gap: theme.spacing.xxs,
    },
    title: {
      color: theme.colors.textPrimary,
      fontSize: theme.typography.sizes.body,
      lineHeight: theme.typography.lineHeights.body,
      fontWeight: theme.typography.weights.medium,
    },
    subtitle: {
      color: theme.colors.textSecondary,
      fontSize: theme.typography.sizes.caption,
      lineHeight: theme.typography.lineHeights.caption,
    },
  });
}
