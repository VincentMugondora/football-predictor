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
        <Text style={styles.labelBase}>
          Home <Text style={styles.homePctText}>{homePct}%</Text>
        </Text>
        <Text style={styles.labelBase}>
          Draw <Text style={styles.drawPctText}>{drawPct}%</Text>
        </Text>
        <Text style={styles.labelBase}>
          Away <Text style={styles.awayPctText}>{awayPct}%</Text>
        </Text>
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
      gap: theme.spacing.sm,
    },
    barTrack: {
      flexDirection: 'row',
      height: theme.layout.stackedBarHeight,
      borderRadius: theme.radii.pill,
      overflow: 'hidden',
      backgroundColor: theme.colors.neutralBarTrack,
    },
    homeSegment: {
      flex: Math.max(1, homePct),
      backgroundColor: theme.colors.primary,
    },
    drawSegment: {
      flex: Math.max(1, drawPct),
      backgroundColor: theme.colors.neutralBadge,
    },
    awaySegment: {
      flex: Math.max(1, awayPct),
      backgroundColor: theme.colors.neutralBarTrack,
    },
    labelsRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    labelBase: {
      color: theme.colors.textSecondary,
      fontSize: theme.typography.sizes.body,
      fontWeight: theme.typography.weights.medium,
    },
    homePctText: {
      color: theme.colors.primary,
      fontWeight: theme.typography.weights.bold,
    },
    drawPctText: {
      color: theme.colors.textPrimary,
      fontWeight: theme.typography.weights.bold,
    },
    awayPctText: {
      color: theme.colors.textSecondary,
      fontWeight: theme.typography.weights.bold,
    },
  });
}
