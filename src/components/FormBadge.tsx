import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { FormResult } from '@/data/types';
import { AppTheme, useAppTheme } from '@/theme/useAppTheme';

export interface FormBadgeProps {
  result: FormResult;
}

export function FormBadge({ result }: FormBadgeProps) {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme, result), [theme, result]);

  const fullLabel =
    result === 'W' ? 'Win' : result === 'D' ? 'Draw' : 'Loss';

  return (
    <View
      style={styles.circle}
      accessible={true}
      accessibilityLabel={`Form result: ${fullLabel}`}>
      <Text style={styles.letter}>{result}</Text>
    </View>
  );
}

function createStyles(theme: AppTheme, result: FormResult) {
  let bg = theme.colors.neutralBadge;
  if (result === 'W') {
    bg = theme.colors.primary;
  } else if (result === 'L') {
    bg = theme.colors.danger;
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
    letter: {
      color: result === 'W' ? theme.colors.primaryTextOnColor : '#FFFFFF',
      fontSize: theme.typography.sizes.caption,
      fontWeight: theme.typography.weights.bold,
    },
  });
}
