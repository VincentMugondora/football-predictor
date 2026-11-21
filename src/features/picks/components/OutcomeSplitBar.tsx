import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { OutcomeTuple } from '@/data/types';
import { AppTheme, useAppTheme } from '@/theme/useAppTheme';

export interface OutcomeSplitBarProps {
  probabilities: OutcomeTuple; // [Home, Draw, Away]
  home: string;
  away: string;
  /** "full" shows a labelled row under the bar; "thin" is the bar alone. */
  variant?: 'full' | 'thin';
}

/** One bar split into home / draw / away chances, coloured by lightness so it reads without colour. */
export function OutcomeSplitBar({ probabilities, home, away, variant = 'full' }: OutcomeSplitBarProps) {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme, variant), [theme, variant]);
  const homePct = Math.round(probabilities[0] * 100);
  const drawPct = Math.round(probabilities[1] * 100);
  const awayPct = Math.max(0, 100 - homePct - drawPct);

  return (
    <View
      style={styles.wrapper}
      accessible
      accessibilityLabel={`Chances: ${home} win ${homePct}%, draw ${drawPct}%, ${away} win ${awayPct}%`}
    >
      <View style={styles.bar}>
        <View style={[styles.segment, styles.home, { flex: Math.max(homePct, 1) }]} />
        <View style={[styles.segment, styles.draw, { flex: Math.max(drawPct, 1) }]} />
        <View style={[styles.segment, styles.away, { flex: Math.max(awayPct, 1) }]} />
      </View>
      {variant === 'full' ? (
        <View style={styles.labels}>
          <Text style={styles.label} numberOfLines={1}>
            <Text style={styles.pct}>{homePct}%</Text> {home}
          </Text>
          <Text style={styles.label}>
            <Text style={styles.pct}>{drawPct}%</Text> Draw
          </Text>
          <Text style={[styles.label, styles.labelRight]} numberOfLines={1}>
            <Text style={styles.pct}>{awayPct}%</Text> {away}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

function createStyles(theme: AppTheme, variant: 'full' | 'thin') {
  const height = variant === 'full' ? 12 : 6;
  return StyleSheet.create({
    wrapper: { gap: theme.spacing.sm },
    bar: {
      flexDirection: 'row',
      height,
      borderRadius: height / 2,
      overflow: 'hidden',
      gap: 2,
    },
    segment: { height },
    home: { backgroundColor: theme.colors.primary },
    draw: { backgroundColor: theme.colors.probBarDraw },
    away: { backgroundColor: theme.colors.probBarAway },
    labels: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: theme.spacing.sm,
    },
    label: {
      flexShrink: 1,
      color: theme.colors.textSecondary,
      fontSize: 13,
    },
    labelRight: { textAlign: 'right' },
    pct: {
      color: theme.colors.textPrimary,
      fontWeight: theme.typography.weights.bold,
    },
  });
}
