import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { BetResult } from '@/data/types';
import { AppTheme, useAppTheme } from '@/theme/useAppTheme';

export interface ResultIconBadgeProps {
  result: BetResult;
}

export function ResultIconBadge({ result }: ResultIconBadgeProps) {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme, result), [theme, result]);

  const symbol =
    result === 'Win'
      ? '✓'
      : result === 'Loss'
        ? '✕'
        : result === 'Void'
          ? '–'
          : '•';

  return (
    <View
      style={styles.circle}
      accessible={true}
      accessibilityLabel={`Bet outcome: ${result}`}>
      <Text style={styles.symbol}>{symbol}</Text>
    </View>
  );
}

function createStyles(theme: AppTheme, result: BetResult) {
  let bg = theme.colors.neutralBadge;
  let textColor = '#FFFFFF';

  if (result === 'Win') {
    bg = theme.colors.primary;
    textColor = theme.colors.primaryTextOnColor;
  } else if (result === 'Loss') {
    bg = theme.colors.danger;
    textColor = '#FFFFFF';
  } else if (result === 'Pending') {
    bg = theme.colors.badgeGold;
    textColor = theme.colors.badgeGoldText;
  }

  return StyleSheet.create({
    circle: {
      width: theme.layout.badgeCircleSize,
      height: theme.layout.badgeCircleSize,
      borderRadius: theme.radii.pill,
      backgroundColor: bg,
      alignItems: 'center',
      justifyContent: 'center',
    },
    symbol: {
      color: textColor,
      fontSize: theme.typography.sizes.bodyStrong,
      fontWeight: theme.typography.weights.bold,
    },
  });
}
