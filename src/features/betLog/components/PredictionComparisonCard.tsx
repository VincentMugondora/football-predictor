import React, { memo, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { ResultIconBadge } from '@/components/ResultIconBadge';
import { TeamCrest } from '@/components/TeamCrest';
import { MatchResultComparison } from '@/data/types';
import { formatPercentage } from '@/lib/calculations';
import { AppTheme, useAppTheme } from '@/theme/useAppTheme';

export interface PredictionComparisonCardProps {
  item: MatchResultComparison;
}

function formatShortDate(isoDate: string): string {
  const dt = new Date(isoDate);
  if (Number.isNaN(dt.getTime())) {
    return isoDate.slice(0, 10);
  }
  return dt.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function PredictionComparisonCardComponent({ item }: PredictionComparisonCardProps) {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme, item.correct), [theme, item.correct]);

  const [pH, pD, pA] = item.p;
  const predictedProb =
    item.predicted_outcome === 'Home' ? pH : item.predicted_outcome === 'Draw' ? pD : pA;

  return (
    <View
      style={styles.card}
      accessible={true}
      accessibilityLabel={`${item.league} on ${formatShortDate(item.date)}: ${item.home} ${item.actual_score} ${item.away}. Model predicted ${item.predicted_outcome} (${formatPercentage(predictedProb, 0)}), actual outcome ${item.actual_outcome}, ${item.correct ? 'Hit' : 'Miss'}`}
    >
      {/* League & Date header */}
      <View style={styles.topHeader}>
        <Text style={styles.leagueText}>
          {item.league} • {formatShortDate(item.date)}
        </Text>
        <View
          style={[
            styles.verdictPill,
            item.correct ? styles.verdictHit : styles.verdictMiss,
          ]}
        >
          <Text
            style={[
              styles.verdictPillText,
              item.correct ? styles.verdictHitText : styles.verdictMissText,
            ]}
          >
            {item.correct ? '✓ PREDICTION HIT' : '✕ PREDICTION MISS'}
          </Text>
        </View>
      </View>

      {/* Main scoreline & comparison row */}
      <View style={styles.mainRow}>
        <View style={styles.clubsBox}>
          <View style={styles.clubCol}>
            <TeamCrest teamName={item.home} size="sm" />
            <Text style={styles.clubName} numberOfLines={1}>
              {item.home}
            </Text>
          </View>

          <View style={styles.scoreCol}>
            <Text style={styles.scoreText}>{item.actual_score}</Text>
            <Text style={styles.ftLabel}>FT ({item.actual_outcome})</Text>
          </View>

          <View style={styles.clubCol}>
            <TeamCrest teamName={item.away} size="sm" />
            <Text style={styles.clubName} numberOfLines={1}>
              {item.away}
            </Text>
          </View>
        </View>

        <View style={styles.predictedCol}>
          <Text style={styles.predictedLabel}>Predicted</Text>
          <Text style={styles.predictedValue}>{item.predicted_outcome}</Text>
          <Text style={styles.predictedProb}>{formatPercentage(predictedProb, 0)}</Text>
        </View>

        <ResultIconBadge result={item.correct ? 'Win' : 'Loss'} />
      </View>

      {/* Pre-match probabilities vs Closing Odds */}
      <View style={styles.footerRow}>
        <Text style={styles.probsText}>
          Pre-match Model: H {formatPercentage(pH, 0)} • D {formatPercentage(pD, 0)} • A{' '}
          {formatPercentage(pA, 0)}
        </Text>
        <Text style={styles.marketText}>
          Mkt Fav: {item.book_favourite} ({item.book_correct ? '✓' : '✕'})
        </Text>
      </View>
    </View>
  );
}

export const PredictionComparisonCard = memo(PredictionComparisonCardComponent);

function createStyles(theme: AppTheme, isCorrect: boolean) {
  return StyleSheet.create({
    card: {
      backgroundColor: theme.colors.surface,
      borderColor: isCorrect ? theme.colors.borderAccent : theme.colors.border,
      borderWidth: theme.layout.borderWidth,
      borderRadius: theme.radii.card,
      padding: theme.spacing.md,
      gap: theme.spacing.sm,
      marginBottom: theme.spacing.md,
    },
    topHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: theme.spacing.xs,
    },
    leagueText: {
      color: theme.colors.textSecondary,
      fontSize: theme.typography.sizes.caption,
      fontWeight: theme.typography.weights.medium,
      flex: 1,
    },
    verdictPill: {
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: theme.spacing.xxs,
      borderRadius: theme.radii.pill,
      borderWidth: theme.layout.borderWidth,
    },
    verdictHit: {
      backgroundColor: theme.colors.primaryMuted,
      borderColor: theme.colors.primary,
    },
    verdictMiss: {
      backgroundColor: theme.colors.dangerMuted,
      borderColor: theme.colors.danger,
    },
    verdictPillText: {
      fontSize: theme.typography.sizes.badge,
      fontWeight: theme.typography.weights.bold,
      letterSpacing: 0.4,
    },
    verdictHitText: {
      color: theme.colors.primary,
    },
    verdictMissText: {
      color: theme.colors.danger,
    },
    mainRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: theme.spacing.sm,
    },
    clubsBox: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    clubCol: {
      width: 76,
      alignItems: 'center',
      gap: theme.spacing.xs,
    },
    clubName: {
      color: theme.colors.textPrimary,
      fontSize: theme.typography.sizes.caption,
      fontWeight: theme.typography.weights.semibold,
      textAlign: 'center',
    },
    scoreCol: {
      alignItems: 'center',
      gap: theme.spacing.xxs,
      paddingHorizontal: theme.spacing.xs,
    },
    scoreText: {
      color: theme.colors.textPrimary,
      fontSize: theme.typography.sizes.screenTitle,
      fontWeight: theme.typography.weights.bold,
    },
    ftLabel: {
      color: theme.colors.textSecondary,
      fontSize: theme.typography.sizes.badge,
      fontWeight: theme.typography.weights.semibold,
    },
    predictedCol: {
      alignItems: 'center',
      paddingHorizontal: theme.spacing.xs,
      gap: theme.spacing.xxs,
    },
    predictedLabel: {
      color: theme.colors.textSecondary,
      fontSize: theme.typography.sizes.badge,
    },
    predictedValue: {
      color: theme.colors.textPrimary,
      fontSize: theme.typography.sizes.bodyStrong,
      fontWeight: theme.typography.weights.bold,
    },
    predictedProb: {
      color: isCorrect ? theme.colors.primary : theme.colors.textSecondary,
      fontSize: theme.typography.sizes.caption,
      fontWeight: theme.typography.weights.bold,
    },
    footerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderTopColor: theme.colors.border,
      borderTopWidth: theme.layout.borderWidth,
      paddingTop: theme.spacing.xs,
      gap: theme.spacing.xs,
    },
    probsText: {
      color: theme.colors.textSecondary,
      fontSize: theme.typography.sizes.badge,
      flex: 1,
    },
    marketText: {
      color: theme.colors.textSecondary,
      fontSize: theme.typography.sizes.badge,
      fontWeight: theme.typography.weights.semibold,
    },
  });
}
