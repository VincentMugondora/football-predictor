import { Ionicons } from '@expo/vector-icons';
import React, { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { ConfidenceTag } from '@/components/ConfidenceTag';
import { TeamCrest } from '@/components/TeamCrest';
import { MatchPick, OutcomeKey } from '@/data/types';
import { OutcomeEdgeRow } from '@/features/picks/components/OutcomeEdgeRow';
import { OutcomeSplitBar } from '@/features/picks/components/OutcomeSplitBar';
import { analyzeMatchOutcomes } from '@/lib/calculations';
import { formatLocalTime } from '@/lib/dateUtils';
import {
  confidenceLevel,
  formatLikelyScore,
  formatPredictionHeadline,
  formatTimingHeadline,
} from '@/lib/winnerLabels';
import { AppTheme, useAppTheme } from '@/theme/useAppTheme';

export interface FeaturedMatchCardProps {
  match: MatchPick;
  edgeThreshold: number;
  onPressMatch: (matchId: string) => void;
  onLogOutcome: (match: MatchPick, outcome: OutcomeKey, odds: number) => void;
  showOddsBreakdown?: boolean;
}

export function FeaturedMatchCard({
  match,
  edgeThreshold,
  onPressMatch,
  onLogOutcome,
  showOddsBreakdown = false,
}: FeaturedMatchCardProps) {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const outcomes = useMemo(
    () => analyzeMatchOutcomes(match.p, match.odds, edgeThreshold),
    [match.p, match.odds, edgeThreshold]
  );
  const matchTitle = `${match.home} vs ${match.away}`;
  const headline = formatPredictionHeadline(match);
  const likelyScore = formatLikelyScore(match);
  const timing = formatTimingHeadline(match);

  return (
    <View style={styles.card} accessibilityLabel={`Match of the day: ${matchTitle}`}>
      <View style={styles.topRow}>
        <Text style={styles.eyebrow}>MATCH OF THE DAY</Text>
        <Text style={styles.meta}>
          {match.league} · {formatLocalTime(match.date)}
        </Text>
      </View>

      <View style={styles.scoreboard}>
        <View style={styles.teamCol}>
          <TeamCrest teamName={match.home} size="lg" />
          <Text style={styles.teamName} numberOfLines={2}>
            {match.home}
          </Text>
        </View>
        <View style={styles.centerCol}>
          <Text style={styles.score}>{likelyScore ?? 'vs'}</Text>
          {likelyScore ? <Text style={styles.scoreCaption}>likely score</Text> : null}
        </View>
        <View style={styles.teamCol}>
          <TeamCrest teamName={match.away} size="lg" />
          <Text style={styles.teamName} numberOfLines={2}>
            {match.away}
          </Text>
        </View>
      </View>

      <View style={styles.predictionBox}>
        <View style={styles.predictionTop}>
          <Text style={styles.predictionLabel}>OUR PREDICTION</Text>
          <ConfidenceTag level={confidenceLevel(match)} />
        </View>
        {headline ? <Text style={styles.headline}>{headline}</Text> : null}
        <OutcomeSplitBar probabilities={match.winner?.p ?? match.p} home={match.home} away={match.away} />
      </View>

      {timing ? (
        <View style={styles.timingRow}>
          <Ionicons name="time-outline" size={18} color={theme.colors.primary} />
          <Text style={styles.timingText}>{timing}</Text>
        </View>
      ) : null}

      <TouchableOpacity
        style={styles.cta}
        onPress={() => onPressMatch(match.id)}
        accessibilityRole="button"
        accessibilityLabel={`See full prediction for ${matchTitle}`}
      >
        <Text style={styles.ctaText}>See full prediction</Text>
      </TouchableOpacity>

      {showOddsBreakdown ? (
        <View style={styles.outcomesSection}>
          {outcomes.map((item) => (
            <OutcomeEdgeRow
              key={item.outcome}
              analysis={item}
              matchTitle={matchTitle}
              onLogPress={(outcome, odds) => onLogOutcome(match, outcome, odds)}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    card: {
      gap: theme.spacing.lg,
      padding: 18,
      borderRadius: 22,
      backgroundColor: theme.colors.surfaceHero,
      borderWidth: theme.layout.borderWidth,
      borderColor: theme.colors.borderAccent,
      marginVertical: theme.spacing.xs,
    },
    topRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: theme.spacing.sm,
    },
    eyebrow: {
      color: theme.colors.badgeGold,
      fontSize: 11,
      fontWeight: '900',
      letterSpacing: 1.1,
    },
    meta: {
      color: theme.colors.textSecondary,
      fontSize: 13,
      flexShrink: 1,
      textAlign: 'right',
    },
    scoreboard: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    teamCol: {
      flex: 1,
      alignItems: 'center',
      gap: theme.spacing.sm,
    },
    teamName: {
      color: theme.colors.textPrimary,
      fontSize: 16,
      fontWeight: theme.typography.weights.bold,
      textAlign: 'center',
    },
    centerCol: {
      flex: 1,
      alignItems: 'center',
    },
    score: {
      color: theme.colors.primary,
      fontSize: 44,
      lineHeight: 52,
      fontWeight: '900',
    },
    scoreCaption: {
      color: theme.colors.textMuted,
      fontSize: 12,
    },
    predictionBox: {
      gap: theme.spacing.sm,
      padding: 14,
      borderRadius: 16,
      backgroundColor: theme.colors.surfaceElevated,
    },
    predictionTop: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    predictionLabel: {
      color: theme.colors.textMuted,
      fontSize: 12,
      fontWeight: theme.typography.weights.bold,
      letterSpacing: 0.7,
    },
    headline: {
      color: theme.colors.textPrimary,
      fontSize: 24,
      lineHeight: 30,
      fontWeight: '900',
    },
    timingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
    },
    timingText: {
      flex: 1,
      color: theme.colors.textSecondary,
      fontSize: 14,
    },
    cta: {
      minHeight: 48,
      borderRadius: 14,
      backgroundColor: theme.colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    ctaText: {
      color: theme.colors.primaryTextOnColor,
      fontSize: 16,
      fontWeight: theme.typography.weights.bold,
    },
    outcomesSection: {
      borderTopColor: theme.colors.border,
      borderTopWidth: theme.layout.borderWidth,
      paddingTop: theme.spacing.sm,
      gap: theme.spacing.xs,
    },
  });
}
