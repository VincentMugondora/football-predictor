import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { WinRateComparison } from '@/lib/calculations';
import { AppTheme, useAppTheme } from '@/theme/useAppTheme';

export interface WinRateComparisonCardProps {
  comparison: WinRateComparison;
}

export function WinRateComparisonCard({ comparison }: WinRateComparisonCardProps) {
  const theme = useAppTheme();
  const winPct = Math.round(comparison.winRate * 100);
  const breakEvenPct = Math.round(comparison.breakEvenRate * 100);
  const deltaPct = comparison.delta * 100;
  const deltaSign = deltaPct > 0 ? '+' : '';
  const deltaText = `${deltaSign}${deltaPct.toFixed(1)}%`;

  const styles = useMemo(
    () => createStyles(theme, winPct, breakEvenPct, deltaPct),
    [theme, winPct, breakEvenPct, deltaPct]
  );

  return (
    <View
      style={styles.card}
      accessible={true}
      accessibilityLabel={`Win rate vs break-even rate across ${comparison.settledCount} settled bets: Actual win rate ${winPct}%, Required break-even rate ${breakEvenPct}%, Difference ${deltaText}`}
    >
      <View style={styles.headerRow}>
        <Text style={styles.title}>Win rate vs break-even rate</Text>
        <Text style={styles.deltaBadge}>
          {deltaText} {deltaPct >= 0 ? '▲' : '▼'}
        </Text>
      </View>

      <View style={styles.barGroup}>
        <View style={styles.barRow}>
          <Text style={styles.barLabel}>Actual win rate</Text>
          <View style={styles.track}>
            <View style={styles.winFill} />
          </View>
          <Text style={styles.winValue}>{winPct}%</Text>
        </View>

        <View style={styles.barRow}>
          <Text style={styles.barLabel}>Break-even req.</Text>
          <View style={styles.track}>
            <View style={styles.breakEvenFill} />
          </View>
          <Text style={styles.breakEvenValue}>{breakEvenPct}%</Text>
        </View>
      </View>

      <Text style={styles.caption}>
        Based on {comparison.settledCount} settled bets (excludes Pending and Void).
      </Text>
    </View>
  );
}

function createStyles(
  theme: AppTheme,
  winPct: number,
  breakEvenPct: number,
  deltaPct: number
) {
  const deltaColor =
    deltaPct > 0
      ? theme.colors.primary
      : deltaPct < 0
        ? theme.colors.danger
        : theme.colors.textSecondary;

  return StyleSheet.create({
    card: {
      backgroundColor: theme.colors.surface,
      borderColor: theme.colors.border,
      borderWidth: theme.layout.borderWidth,
      borderRadius: theme.radii.card,
      padding: theme.spacing.lg,
      gap: theme.spacing.md,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    title: {
      color: theme.colors.textPrimary,
      fontSize: theme.typography.sizes.sectionTitle,
      fontWeight: theme.typography.weights.semibold,
    },
    deltaBadge: {
      color: deltaColor,
      fontSize: theme.typography.sizes.bodyStrong,
      fontWeight: theme.typography.weights.bold,
    },
    barGroup: {
      gap: theme.spacing.sm,
    },
    barRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
    },
    barLabel: {
      width: 108,
      color: theme.colors.textSecondary,
      fontSize: theme.typography.sizes.body,
    },
    track: {
      flex: 1,
      height: theme.layout.progressBarHeight,
      backgroundColor: theme.colors.neutralBarTrack,
      borderRadius: theme.radii.pill,
      overflow: 'hidden',
    },
    winFill: {
      width: `${Math.min(100, Math.max(2, winPct))}%`,
      height: '100%',
      backgroundColor: theme.colors.primary,
      borderRadius: theme.radii.pill,
    },
    breakEvenFill: {
      width: `${Math.min(100, Math.max(2, breakEvenPct))}%`,
      height: '100%',
      backgroundColor: theme.colors.neutralBadge,
      borderRadius: theme.radii.pill,
    },
    winValue: {
      width: 44,
      textAlign: 'right',
      color: theme.colors.primary,
      fontSize: theme.typography.sizes.bodyStrong,
      fontWeight: theme.typography.weights.bold,
    },
    breakEvenValue: {
      width: 44,
      textAlign: 'right',
      color: theme.colors.textPrimary,
      fontSize: theme.typography.sizes.bodyStrong,
      fontWeight: theme.typography.weights.bold,
    },
    caption: {
      color: theme.colors.textMuted,
      fontSize: theme.typography.sizes.caption,
    },
  });
}
