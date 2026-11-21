import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { WinRateComparison } from '@/lib/calculations';
import { AppTheme, useAppTheme } from '@/theme/useAppTheme';

export interface WinRateComparisonCardProps {
  comparison: WinRateComparison;
}

export function WinRateComparisonCard({ comparison }: WinRateComparisonCardProps) {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const winPct = Math.round(comparison.winRate * 100);
  const breakEvenPct = Math.round(comparison.breakEvenRate * 100);
  const gap = Math.round(comparison.delta * 100);
  const verdict =
    comparison.settledCount === 0
      ? 'No finished bets yet.'
      : gap >= 0
        ? `You are ${gap} points above break-even so far.`
        : `You are ${-gap} points below break-even so far.`;

  return (
    <View
      style={styles.card}
      accessible={true}
      accessibilityLabel={`Are you winning often enough? You win ${winPct}%. You need ${breakEvenPct}% to break even. ${verdict}`}
    >
      <View style={styles.header}>
        <Text style={styles.title} accessibilityRole="header">
          Are you winning often enough?
        </Text>
        <Text style={styles.subtitle}>
          At your odds you need to win {breakEvenPct}% of bets just to break even.
        </Text>
      </View>
      <View style={styles.barGroup}>
        <View style={styles.barTop}>
          <Text style={styles.barLabel}>You win</Text>
          <Text style={[styles.barValue, gap >= 0 ? styles.good : styles.bad]}>{winPct}%</Text>
        </View>
        <View style={styles.track}>
          <View style={[styles.fill, gap >= 0 ? styles.fillGood : styles.fillBad, { width: `${winPct}%` }]} />
        </View>
      </View>
      <View style={styles.barGroup}>
        <View style={styles.barTop}>
          <Text style={styles.barLabel}>Needed to break even</Text>
          <Text style={styles.barValue}>{breakEvenPct}%</Text>
        </View>
        <View style={styles.track}>
          <View style={[styles.fill, styles.fillNeutral, { width: `${breakEvenPct}%` }]} />
        </View>
      </View>
      <Text style={styles.caption}>
        {verdict} Based on {comparison.settledCount} finished bets (not counting pending or void).
      </Text>
    </View>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    card: {
      gap: 14,
      padding: 18,
      borderRadius: 18,
      backgroundColor: theme.colors.surface,
      borderWidth: theme.layout.borderWidth,
      borderColor: theme.colors.border,
    },
    header: { gap: 2 },
    title: { color: theme.colors.textPrimary, fontSize: 17, fontWeight: theme.typography.weights.bold },
    subtitle: { color: theme.colors.textSecondary, fontSize: 13, lineHeight: 19 },
    barGroup: { gap: 6 },
    barTop: { flexDirection: 'row', justifyContent: 'space-between' },
    barLabel: { color: theme.colors.textPrimary, fontSize: 14 },
    barValue: { color: theme.colors.textPrimary, fontSize: 14, fontWeight: theme.typography.weights.bold },
    good: { color: theme.colors.formWin },
    bad: { color: theme.colors.dangerText },
    track: { height: 12, borderRadius: 6, backgroundColor: theme.colors.neutralBarTrack, overflow: 'hidden' },
    fill: { height: 12, borderRadius: 6 },
    fillGood: { backgroundColor: theme.colors.formWin },
    fillBad: { backgroundColor: theme.colors.danger },
    fillNeutral: { backgroundColor: theme.colors.probBarDraw },
    caption: { color: theme.colors.textSecondary, fontSize: 13, lineHeight: 19 },
  });
}
