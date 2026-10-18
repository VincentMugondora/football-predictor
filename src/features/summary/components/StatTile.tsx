import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AppTheme, useAppTheme } from '@/theme/useAppTheme';

export type StatTileTone = 'default' | 'positive' | 'negative' | 'warning';

export interface StatTileProps {
  label: string;
  value: string;
  sublabel?: string;
  tone?: StatTileTone;
}

export function StatTile({
  label,
  value,
  sublabel,
  tone = 'default',
}: StatTileProps) {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme, tone), [theme, tone]);

  return (
    <View
      style={styles.tile}
      accessible={true}
      accessibilityLabel={`${label}: ${value}${sublabel ? `, ${sublabel}` : ''}`}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
      {sublabel ? <Text style={styles.sublabel}>{sublabel}</Text> : null}
    </View>
  );
}

function createStyles(theme: AppTheme, tone: StatTileTone) {
  let valueColor = theme.colors.textPrimary;
  if (tone === 'positive') {
    valueColor = theme.colors.primary;
  } else if (tone === 'negative') {
    valueColor = theme.colors.danger;
  } else if (tone === 'warning') {
    valueColor = theme.colors.badgeGold;
  }

  return StyleSheet.create({
    tile: {
      flex: 1,
      minWidth: '45%',
      backgroundColor: theme.colors.surface,
      borderColor: theme.colors.border,
      borderWidth: theme.layout.borderWidth,
      borderRadius: theme.radii.card,
      padding: theme.spacing.lg,
      gap: theme.spacing.xs,
    },
    label: {
      color: theme.colors.textSecondary,
      fontSize: theme.typography.sizes.caption,
      fontWeight: theme.typography.weights.semibold,
    },
    value: {
      color: valueColor,
      fontSize: theme.typography.sizes.statValue,
      lineHeight: theme.typography.lineHeights.statValue,
      fontWeight: theme.typography.weights.bold,
    },
    sublabel: {
      color: theme.colors.textMuted,
      fontSize: theme.typography.sizes.caption,
    },
  });
}
