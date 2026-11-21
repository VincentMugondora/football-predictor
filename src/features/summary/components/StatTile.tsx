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

export function StatTile({ label, value, sublabel, tone = 'default' }: StatTileProps) {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme, tone), [theme, tone]);

  return (
    <View
      style={styles.tile}
      accessible={true}
      accessibilityLabel={`${label}: ${value}${sublabel ? `, ${sublabel}` : ''}`}
    >
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
      {sublabel ? <Text style={styles.sublabel}>{sublabel}</Text> : null}
    </View>
  );
}

function createStyles(theme: AppTheme, tone: StatTileTone) {
  const valueColor =
    tone === 'positive'
      ? theme.colors.formWin
      : tone === 'negative'
        ? theme.colors.dangerText
        : tone === 'warning'
          ? theme.colors.warningText
          : theme.colors.textPrimary;
  return StyleSheet.create({
    tile: {
      flex: 1,
      gap: 6,
      padding: theme.spacing.lg,
      borderRadius: 18,
      backgroundColor: theme.colors.surface,
      borderWidth: theme.layout.borderWidth,
      borderColor: theme.colors.border,
    },
    label: { color: theme.colors.textSecondary, fontSize: 13 },
    value: { color: valueColor, fontSize: 26, fontWeight: '900' },
    sublabel: { color: theme.colors.textMuted, fontSize: 12, lineHeight: 17 },
  });
}
