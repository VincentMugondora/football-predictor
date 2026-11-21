import { Ionicons } from '@expo/vector-icons';
import React, { memo, useMemo } from 'react';
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
  formatWinnerShort,
  pickChance,
  summariseWinner,
} from '@/lib/winnerLabels';
import { AppTheme, useAppTheme } from '@/theme/useAppTheme';

export interface MatchPickCardProps {
  match: MatchPick;
  edgeThreshold: number;
  isFavourite: boolean;
  onToggleFavourite: (matchId: string) => void;
  onPressMatch: (matchId: string) => void;
  onLogOutcome: (match: MatchPick, outcome: OutcomeKey, odds: number) => void;
  showOddsBreakdown?: boolean;
}

function MatchPickCardComponent({
  match,
  edgeThreshold,
  isFavourite,
  onToggleFavourite,
  onPressMatch,
  onLogOutcome,
  showOddsBreakdown = false,
}: MatchPickCardProps) {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const outcomes = useMemo(
    () => (showOddsBreakdown ? analyzeMatchOutcomes(match.p, match.odds, edgeThreshold) : []),
    [showOddsBreakdown, match.p, match.odds, edgeThreshold]
  );

  const matchTitle = `${match.home} vs ${match.away}`;
  const kickoff = formatLocalTime(match.date);
  const summary = summariseWinner(match);
  const pickText = summary?.headline ?? 'No prediction';
  const likelyScore = formatLikelyScore(match);
  const chancePct = Math.round(pickChance(match) * 100);
  const level = confidenceLevel(match);

  return (
    <View style={styles.wrapper}>
      <TouchableOpacity
        style={styles.card}
        onPress={() => onPressMatch(match.id)}
        accessibilityRole="button"
        accessibilityLabel={`${matchTitle}, ${match.league}, kickoff ${kickoff}. Prediction ${
          formatWinnerShort(match) ?? pickText
        }, ${chancePct}% chance, ${level}. Opens full prediction`}
      >
        <View style={styles.topRow}>
          <Text style={styles.meta} numberOfLines={1}>
            {match.league} · {kickoff}
          </Text>
          <View style={styles.topRight}>
            <ConfidenceTag level={level} />
            <TouchableOpacity
              style={styles.starButton}
              onPress={() => onToggleFavourite(match.id)}
              accessibilityRole="button"
              accessibilityState={{ selected: isFavourite }}
              accessibilityLabel={
                isFavourite ? `Remove ${matchTitle} from favourites` : `Save ${matchTitle} to favourites`
              }
            >
              <Ionicons
                name={isFavourite ? 'star' : 'star-outline'}
                size={20}
                color={isFavourite ? theme.colors.primary : theme.colors.textSecondary}
              />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.teamsRow}>
          <View style={styles.teamSide}>
            <TeamCrest teamName={match.home} size="sm" />
            <Text style={styles.teamName} numberOfLines={2}>
              {match.home}
            </Text>
          </View>
          <Text style={styles.score}>{likelyScore ?? 'vs'}</Text>
          <View style={[styles.teamSide, styles.teamSideRight]}>
            <Text style={[styles.teamName, styles.teamNameRight]} numberOfLines={2}>
              {match.away}
            </Text>
            <TeamCrest teamName={match.away} size="sm" />
          </View>
        </View>

        <View style={styles.pickRow}>
          <Text style={styles.pickText} numberOfLines={1}>
            {pickText}
          </Text>
          <Text style={styles.chanceText}>{chancePct}% chance</Text>
        </View>
        <OutcomeSplitBar
          probabilities={match.winner?.p ?? match.p}
          home={match.home}
          away={match.away}
          variant="thin"
        />
        {match.low_confidence ? (
          <Text style={styles.lowNote}>Limited history for one of these teams.</Text>
        ) : null}
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

export const MatchPickCard = memo(MatchPickCardComponent);

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    wrapper: { marginBottom: theme.spacing.md },
    card: {
      gap: theme.spacing.md,
      padding: theme.spacing.lg,
      borderRadius: 18,
      backgroundColor: theme.colors.surface,
      borderWidth: theme.layout.borderWidth,
      borderColor: theme.colors.border,
    },
    topRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: theme.spacing.sm,
    },
    meta: {
      flexShrink: 1,
      color: theme.colors.textSecondary,
      fontSize: 13,
    },
    topRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.xs,
    },
    starButton: {
      width: theme.layout.minTouchTarget,
      height: theme.layout.minTouchTarget,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: -theme.spacing.sm,
      marginVertical: -theme.spacing.sm,
    },
    teamsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
    },
    teamSide: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    teamSideRight: { justifyContent: 'flex-end' },
    teamName: {
      flexShrink: 1,
      color: theme.colors.textPrimary,
      fontSize: 15,
      fontWeight: theme.typography.weights.bold,
    },
    teamNameRight: { textAlign: 'right' },
    score: {
      color: theme.colors.primary,
      fontSize: 26,
      fontWeight: '900',
      minWidth: 60,
      textAlign: 'center',
    },
    pickRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: theme.spacing.sm,
      paddingTop: 10,
      borderTopWidth: theme.layout.borderWidth,
      borderTopColor: theme.colors.border,
    },
    pickText: {
      flexShrink: 1,
      color: theme.colors.textPrimary,
      fontSize: 16,
      fontWeight: theme.typography.weights.bold,
    },
    chanceText: {
      color: theme.colors.textSecondary,
      fontSize: 13,
    },
    lowNote: {
      color: theme.colors.warningText,
      fontSize: 12,
    },
    outcomesSection: {
      marginTop: theme.spacing.sm,
      gap: theme.spacing.xs,
    },
  });
}
