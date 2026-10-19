import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { OutcomeTuple } from '@/data/types';
import { AppTheme, useAppTheme } from '@/theme/useAppTheme';

export interface StackedProbBarProps {
  probabilities: OutcomeTuple; // [Home, Draw, Away]
}

export function StackedProbBar({ probabilities }: StackedProbBarProps) {
  const theme = useAppTheme();
  const [homeProb, drawProb] = probabilities;
  const homePct = Math.round(homeProb * 100);
  const drawPct = Math.round(drawProb * 100);
  const awayPct = Math.max(0, 100 - homePct - drawPct);

  const styles = useMemo(
    () => createStyles(theme, homePct, drawPct, awayPct),
    [theme, homePct, drawPct, awayPct]
  );

  return (
    <View
      style={styles.wrapper}
      accessible={true}
      accessibilityLabel={`Match probabilities: Home ${homePct}%, Draw ${drawPct}%, Away ${awayPct}%`}
    >
      <View style={styles.barTrack}>
        <View style={styles.homeSegment} />
        <View style={styles.drawSegment} />
        <View style={styles.awaySegment} />
      </View>
      <View style={styles.labelsRow}>
        <View style={styles.statCol}>
          <Text style={styles.pctText}>{homePct}%</Text>
          <Text style={styles.outcomeLabel}>Home</Text>
        </View>
        <View style={styles.statCol}>
          <Text style={styles.pctText}>{drawPct}%</Text>
          <Text style={styles.outcomeLabel}>Draw</Text>
        </View>
        <View style={styles.statCol}>
          <Text style={styles.pctText}>{awayPct}%</Text>
          <Text style={styles.outcomeLabel}>Away</Text>
        </View>
      </View>
    </View>
  );
}

function createStyles(
  theme: AppTheme,
  homePct: number,
  drawPct: number,
  awayPct: number
) {
  return StyleSheet.create({
    wrapper: {
      gap: theme.spacing.md,
    },
    barTrack: {
      flexDirection: 'row',
      height: theme.layout.stackedBarHeight,
      borderRadius: theme.radii.pill,
      overflow: 'hidden',
      backgroundColor: theme.colors.probBarAway,
    },
    homeSegment: {
      flex: Math.max(1, homePct),
      backgroundColor: theme.colors.primary,
      borderTopRightRadius: theme.radii.pill,
      borderBottomRightRadius: theme.radii.pill,
    },
    drawSegment: {
      flex: Math.max(1, drawPct),
      backgroundColor: theme.colors.probBarDraw,
      borderTopRightRadius: theme.radii.pill,
      borderBottomRightRadius: theme.radii.pill,
    },
    awaySegment: {
      flex: Math.max(1, awayPct),
      backgroundColor: theme.colors.probBarAway,
    },
    labelsRow: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      alignItems: 'center',
    },
    statCol: {
      flex: 1,
      alignItems: 'center',
      gap: theme.spacing.xxs,
    },
    pctText: {
      color: theme.colors.textPrimary,
      fontSize: theme.typography.sizes.statValue,
      lineHeight: theme.typography.lineHeights.statValue,
      fontWeight: theme.typography.weights.bold,
    },
    outcomeLabel: {
      color: theme.colors.textSecondary,
      fontSize: theme.typography.sizes.body,
      fontWeight: theme.typography.weights.regular,
    },
  });
}
