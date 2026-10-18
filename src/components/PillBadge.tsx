import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AppTheme, useAppTheme } from '@/theme/useAppTheme';

export type PillBadgeVariant = 'gold' | 'emerald' | 'warning' | 'danger' | 'neutral';

export interface PillBadgeProps {
  label: string;
  variant?: PillBadgeVariant;
}

export function PillBadge({ label, variant = 'gold' }: PillBadgeProps) {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme, variant), [theme, variant]);

  return (
    <View style={styles.pill}>
      <Text style={styles.text}>{label}</Text>
    </View>
  );
}

function createStyles(theme: AppTheme, variant: PillBadgeVariant) {
  let backgroundColor = theme.colors.badgeGold;
  let textColor = theme.colors.badgeGoldText;

  switch (variant) {
    case 'emerald':
      backgroundColor = theme.colors.primaryMuted;
      textColor = theme.colors.primary;
      break;
    case 'warning':
      backgroundColor = theme.colors.surfaceWarningBanner;
      textColor = theme.colors.badgeGold;
      break;
    case 'danger':
      backgroundColor = theme.colors.dangerMuted;
      textColor = theme.colors.danger;
      break;
    case 'neutral':
      backgroundColor = theme.colors.surfaceElevated;
      textColor = theme.colors.textSecondary;
      break;
    case 'gold':
    default:
      backgroundColor = theme.colors.badgeGold;
      textColor = theme.colors.badgeGoldText;
      break;
  }

  return StyleSheet.create({
    pill: {
      backgroundColor,
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: theme.spacing.xs,
      borderRadius: theme.radii.pill,
      alignSelf: 'flex-start',
    },
    text: {
      color: textColor,
      fontSize: theme.typography.sizes.badge,
      lineHeight: theme.typography.lineHeights.badge,
      fontWeight: theme.typography.weights.bold,
      letterSpacing: 0.4,
    },
  });
}
