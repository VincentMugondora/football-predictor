import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AppTheme, useAppTheme } from '@/theme/useAppTheme';

export interface StatComparisonRowProps {
  label: string;
  homeValue: string;
  awayValue: string;
  isLast?: boolean;
}

export function StatComparisonRow({
  label,
  homeValue,
  awayValue,
  isLast = false,
}: StatComparisonRowProps) {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme, isLast), [theme, isLast]);

  return (
    <View
      style={styles.row}
      accessible={true}
      accessibilityLabel={`${label}: Home ${homeValue}, Away ${awayValue}`}
    >
      <Text style={styles.valueText}>{homeValue}</Text>
      <Text style={styles.labelText}>{label}</Text>
      <Text style={styles.valueText}>{awayValue}</Text>
    </View>
  );
}

function createStyles(theme: AppTheme, isLast: boolean) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: theme.spacing.md,
      borderBottomColor: theme.colors.border,
      borderBottomWidth: isLast ? 0 : theme.layout.borderWidth,
    },
    valueText: {
      color: theme.colors.textPrimary,
      fontSize: theme.typography.sizes.statValue,
      lineHeight: theme.typography.lineHeights.statValue,
      fontWeight: theme.typography.weights.bold,
      minWidth: 52,
    },
    labelText: {
      color: theme.colors.textSecondary,
      fontSize: theme.typography.sizes.body,
      fontWeight: theme.typography.weights.medium,
      textAlign: 'center',
      flex: 1,
    },
  });
}
