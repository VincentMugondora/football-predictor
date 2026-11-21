import React, { memo, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { MatchResultComparison } from '@/data/types';
import { formatShortDayAndMonth } from '@/lib/dateUtils';
import { resultLabel } from '@/lib/historyStats';
import { AppTheme, useAppTheme } from '@/theme/useAppTheme';

export interface PredictionComparisonCardProps {
  item: MatchResultComparison;
}

function predictedLabel(item: MatchResultComparison): string {
  if (item.predicted_outcome === 'Draw') return 'Draw';
  const team = item.predicted_outcome === 'Home' ? item.home : item.away;
  return item.predicted_margin ? `${team} by ${item.predicted_margin}` : `${team} win`;
}

function PredictionComparisonCardComponent({ item }: PredictionComparisonCardProps) {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const chance =
    item.predicted_outcome === 'Home' ? item.p[0] : item.predicted_outcome === 'Draw' ? item.p[1] : item.p[2];
  const actualScore = item.actual_score.replace(/\s*-\s*/, '–');
  const predictedScore = item.predicted_score ? item.predicted_score.replace('-', '–') : null;
  const checks: { label: string; hit: boolean }[] = [{ label: 'Winner', hit: item.correct }];
  if (typeof item.hit_margin === 'boolean') checks.push({ label: 'Margin', hit: item.hit_margin });
  if (typeof item.hit_score === 'boolean') checks.push({ label: 'Score', hit: item.hit_score });

  return (
    <View
      style={styles.card}
      accessible
      accessibilityLabel={`${item.home} vs ${item.away}, ${item.league}. We predicted ${predictedLabel(item)}${
        predictedScore ? ` ${predictedScore}` : ''
      }. Final score ${actualScore}. Winner ${item.correct ? 'right' : 'wrong'}.`}
    >
      <View style={styles.topRow}>
        <Text style={styles.meta}>{formatShortDayAndMonth(item.date)}</Text>
        <Text style={styles.meta}>{item.league}</Text>
      </View>
      <Text style={styles.title}>
        {item.home} vs {item.away}
      </Text>
      <View style={styles.boxes}>
        <View style={styles.box}>
          <Text style={styles.boxLabel}>PREDICTED</Text>
          <Text style={styles.boxScoreLime}>{predictedScore ?? '–'}</Text>
          <Text style={styles.boxText} numberOfLines={1}>
            {predictedLabel(item)} · {Math.round(chance * 100)}%
          </Text>
        </View>
        <View style={[styles.box, item.correct ? styles.boxRight : styles.boxWrong]}>
          <Text style={styles.boxLabel}>REAL RESULT</Text>
          <Text style={styles.boxScore}>{actualScore}</Text>
          <Text style={styles.boxText} numberOfLines={1}>
            {resultLabel(item.home, item.away, item.actual_score.replace(/\s/g, ''))}
          </Text>
        </View>
      </View>
      <View style={styles.checks}>
        {checks.map((check) => (
          <View key={check.label} style={[styles.check, check.hit ? styles.checkRight : styles.checkWrong]}>
            <Text style={[styles.checkText, check.hit ? styles.checkTextRight : styles.checkTextWrong]}>
              {check.hit ? '✓' : '✕'} {check.label}
            </Text>
          </View>
        ))}
        {item.book_favourite ? (
          <Text style={styles.bookText}>
            Bookmakers’ favourite: {item.book_favourite} {item.book_correct ? '✓' : '✕'}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

export const PredictionComparisonCard = memo(PredictionComparisonCardComponent);

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    card: {
      gap: 10,
      padding: 14,
      borderRadius: 16,
      backgroundColor: theme.colors.surface,
      borderWidth: theme.layout.borderWidth,
      borderColor: theme.colors.border,
      marginBottom: theme.spacing.md,
    },
    topRow: { flexDirection: 'row', justifyContent: 'space-between' },
    meta: { color: theme.colors.textSecondary, fontSize: 12 },
    title: { color: theme.colors.textPrimary, fontSize: 16, fontWeight: theme.typography.weights.bold },
    boxes: { flexDirection: 'row', gap: theme.spacing.sm },
    box: { flex: 1, padding: 10, borderRadius: 12, backgroundColor: theme.colors.surfaceElevated },
    boxRight: { backgroundColor: theme.colors.winSurface },
    boxWrong: { backgroundColor: theme.colors.surfaceDangerBanner },
    boxLabel: { color: theme.colors.textMuted, fontSize: 11, fontWeight: theme.typography.weights.bold, letterSpacing: 0.6 },
    boxScore: { color: theme.colors.textPrimary, fontSize: 20, fontWeight: '900' },
    boxScoreLime: { color: theme.colors.primary, fontSize: 20, fontWeight: '900' },
    boxText: { color: theme.colors.textSecondary, fontSize: 12 },
    checks: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
    check: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: theme.radii.pill },
    checkRight: { backgroundColor: theme.colors.winSurface },
    checkWrong: { backgroundColor: theme.colors.surfaceDangerBanner },
    checkText: { fontSize: 12, fontWeight: theme.typography.weights.bold },
    checkTextRight: { color: theme.colors.formWin },
    checkTextWrong: { color: theme.colors.dangerText },
    bookText: { color: theme.colors.textSecondary, fontSize: 12, marginLeft: theme.spacing.xs },
  });
}
