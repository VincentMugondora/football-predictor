import React, { memo, useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { ConfidenceTag } from '@/components/ConfidenceTag';
import { MatchPick } from '@/data/types';
import { impliedFromOdds } from '@/lib/calculations';
import { formatDayTitle, formatLocalTime } from '@/lib/dateUtils';
import { confidenceLevel, formatLikelyScore, summariseWinner } from '@/lib/winnerLabels';
import { AppTheme, useAppTheme } from '@/theme/useAppTheme';

export interface PredictionMatchCardProps {
  match: MatchPick;
  updatedFallbackLabel: string;
  onPressMatch: (matchId: string) => void;
}

function comparisonNote(match: MatchPick, pickIndex: number): string {
  if (!match.odds) return 'No bookmaker odds for this match yet.';
  const ours = match.p[pickIndex];
  const theirs = impliedFromOdds(match.odds)[pickIndex];
  const gap = Math.round((ours - theirs) * 100);
  const name = pickIndex === 0 ? match.home : pickIndex === 2 ? match.away : 'a draw';
  if (Math.abs(gap) < 3) return 'Close to the bookmakers on this one.';
  if (gap > 0) return `We give ${name} a ${gap}-point bigger chance than the odds do.`;
  return `The bookmakers rate ${name} ${-gap} points higher than we do.`;
}

function PredictionMatchCardComponent({ match, updatedFallbackLabel, onPressMatch }: PredictionMatchCardProps) {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const probs = match.p;
  const pickIndex =
    match.winner?.pick === 'home' ? 0 : match.winner?.pick === 'draw' ? 1 : match.winner?.pick === 'away' ? 2 :
      probs.indexOf(Math.max(...probs));
  const implied = match.odds ? impliedFromOdds(match.odds) : null;
  const summary = summariseWinner(match);
  const score = formatLikelyScore(match);
  const labels = [match.home, 'Draw', match.away];
  const matchTitle = `${match.home} vs ${match.away}`;

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => onPressMatch(match.id)}
      accessibilityRole="button"
      accessibilityLabel={`${matchTitle}. Prediction ${summary?.headline ?? ''}${score ? `, likely score ${score}` : ''}. Opens full prediction`}
    >
      <View style={styles.topRow}>
        <Text style={styles.meta} numberOfLines={1}>
          {formatDayTitle(match.date)} {formatLocalTime(match.date)} · {match.league}
        </Text>
        <ConfidenceTag level={confidenceLevel(match)} />
      </View>
      <View style={styles.titleBlock}>
        <Text style={styles.matchTitle}>{matchTitle}</Text>
        <Text style={styles.pick}>
          {summary?.headline ?? 'No prediction'}
          {score ? <Text style={styles.pickScore}>{`  ${score}`}</Text> : null}
        </Text>
      </View>
      <View style={styles.columns}>
        {[0, 1, 2].map((i) => {
          const mine = i === pickIndex;
          return (
            <View key={labels[i]} style={[styles.col, mine ? styles.colMine : null]}>
              <Text style={styles.colLabel} numberOfLines={1}>
                {labels[i]}
              </Text>
              <Text style={[styles.colPct, mine ? styles.colPctMine : null]}>
                {`${Math.round(probs[i] * 100)}%`}
              </Text>
              <Text style={styles.colOdds} numberOfLines={1}>
                {match.odds && implied
                  ? `Odds ${match.odds[i].toFixed(2)} · ${Math.round(implied[i] * 100)}%`
                  : 'No odds'}
              </Text>
            </View>
          );
        })}
      </View>
      <Text style={styles.note}>{comparisonNote(match, pickIndex)}</Text>
      <Text style={styles.updated}>{match.updatedAtLabel ?? updatedFallbackLabel}</Text>
    </TouchableOpacity>
  );
}

export const PredictionMatchCard = memo(PredictionMatchCardComponent);

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    card: {
      gap: theme.spacing.md,
      padding: theme.spacing.lg,
      borderRadius: 18,
      backgroundColor: theme.colors.surface,
      borderWidth: theme.layout.borderWidth,
      borderColor: theme.colors.border,
      marginBottom: theme.spacing.md,
    },
    topRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: theme.spacing.sm,
    },
    meta: { flexShrink: 1, color: theme.colors.textSecondary, fontSize: 13 },
    titleBlock: { gap: 2 },
    matchTitle: { color: theme.colors.textSecondary, fontSize: 15, fontWeight: theme.typography.weights.medium },
    pick: { color: theme.colors.textPrimary, fontSize: 20, fontWeight: '900' },
    pickScore: { color: theme.colors.primary },
    columns: { flexDirection: 'row', gap: theme.spacing.sm },
    col: {
      flex: 1,
      gap: 4,
      padding: 10,
      borderRadius: 12,
      backgroundColor: theme.colors.surfaceElevated,
      borderWidth: theme.layout.borderWidth,
      borderColor: theme.colors.border,
    },
    colMine: { backgroundColor: theme.colors.primaryMuted, borderColor: theme.colors.primary },
    colLabel: { color: theme.colors.textSecondary, fontSize: 12, fontWeight: theme.typography.weights.bold },
    colPct: { color: theme.colors.textPrimary, fontSize: 22, fontWeight: '900' },
    colPctMine: { color: theme.colors.primary },
    colOdds: { color: theme.colors.textSecondary, fontSize: 11 },
    note: { color: theme.colors.textSecondary, fontSize: 13, lineHeight: 19 },
    updated: { color: theme.colors.textMuted, fontSize: 12 },
  });
}
