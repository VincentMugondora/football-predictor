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
  const homeNum = Math.max(0.1, parseFloat(homeValue.replace('%', '')) || 1);
  const awayNum = Math.max(0.1, parseFloat(awayValue.replace('%', '')) || 1);

  const styles = useMemo(
    () => createStyles(theme, isLast, homeNum, awayNum),
    [theme, isLast, homeNum, awayNum]
  );

  return (
    <View
      style={styles.row}
      accessible={true}
      accessibilityLabel={`${label}: Home ${homeValue}, Away ${awayValue}`}
    >
      <Text style={styles.valueTextLeft}>{homeValue}</Text>
      <View style={styles.centerCol}>
        <Text style={styles.labelText}>{label}</Text>
        <View style={styles.barTrack}>
          <View style={styles.barHome} />
          <View style={styles.barAway} />
        </View>
      </View>
      <Text style={styles.valueTextRight}>{awayValue}</Text>
    </View>
  );
}

function createStyles(
  theme: AppTheme,
  isLast: boolean,
  homeNum: number,
  awayNum: number
) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: theme.spacing.sm,
      gap: theme.spacing.md,
      borderBottomColor: theme.colors.border,
      borderBottomWidth: isLast ? 0 : 0,
    },
    valueTextLeft: {
      color: theme.colors.textPrimary,
      fontSize: theme.typography.sizes.statValue,
      lineHeight: theme.typography.lineHeights.statValue,
      fontWeight: theme.typography.weights.bold,
      minWidth: 46,
      textAlign: 'left',
    },
    valueTextRight: {
      color: theme.colors.textPrimary,
      fontSize: theme.typography.sizes.statValue,
      lineHeight: theme.typography.lineHeights.statValue,
      fontWeight: theme.typography.weights.bold,
      minWidth: 46,
      textAlign: 'right',
    },
    centerCol: {
      flex: 1,
      alignItems: 'center',
      gap: theme.spacing.xs,
    },
    labelText: {
      color: theme.colors.textPrimary,
      fontSize: theme.typography.sizes.body,
      fontWeight: theme.typography.weights.medium,
      textAlign: 'center',
    },
    barTrack: {
      width: '100%',
      height: theme.layout.progressBarHeight,
      borderRadius: theme.radii.pill,
      backgroundColor: theme.colors.probBarAway,
      flexDirection: 'row',
      overflow: 'hidden',
    },
    barHome: {
      flex: homeNum,
      backgroundColor: theme.colors.primary,
      borderRadius: theme.radii.pill,
    },
    barAway: {
      flex: awayNum,
      backgroundColor: theme.colors.probBarAway,
    },
  });
}
