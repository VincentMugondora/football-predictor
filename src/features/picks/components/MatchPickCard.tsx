import { Ionicons } from '@expo/vector-icons';
import React, { memo, useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { TeamCrest } from '@/components/TeamCrest';
import { MatchPick, OutcomeKey } from '@/data/types';
import { OutcomeEdgeRow } from '@/features/picks/components/OutcomeEdgeRow';
import { analyzeMatchOutcomes } from '@/lib/calculations';
import { formatKickoffTime } from '@/lib/dateUtils';
import { AppTheme, useAppTheme } from '@/theme/useAppTheme';

export interface MatchPickCardProps {
  match: MatchPick;
  edgeThreshold: number;
  isFavourite: boolean;
  onToggleFavourite: (matchId: string) => void;
  onPressMatch: (matchId: string) => void;
  onLogOutcome: (match: MatchPick, outcome: OutcomeKey, odds: number) => void;
}

function MatchPickCardComponent({
  match,
  edgeThreshold,
  isFavourite,
  onToggleFavourite,
  onPressMatch,
  onLogOutcome,
}: MatchPickCardProps) {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const outcomes = useMemo(
    () => analyzeMatchOutcomes(match.p, match.odds, edgeThreshold),
    [match.p, match.odds, edgeThreshold]
  );

  const matchTitle = `${match.home} vs ${match.away}`;
  const kickoff = formatKickoffTime(match.date);

  return (
    <View style={styles.card}>
      <View style={styles.fixtureRow}>
        <TouchableOpacity
          style={styles.teamsTouchArea}
          onPress={() => onPressMatch(match.id)}
          accessibilityRole="button"
          accessibilityLabel={`View match details for ${matchTitle}, kickoff ${kickoff}`}>
          <View style={styles.timeColumn}>
            <Text style={styles.timeText}>{kickoff}</Text>
          </View>

          <View style={styles.stackedTeamsColumn}>
            <View style={styles.teamLine}>
              <TeamCrest teamName={match.home} size="sm" />
              <Text style={styles.teamName} numberOfLines={1}>
                {match.home}
              </Text>
            </View>
            <View style={styles.teamLine}>
              <TeamCrest teamName={match.away} size="sm" />
              <Text style={styles.teamName} numberOfLines={1}>
                {match.away}
              </Text>
            </View>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.starButton}
          onPress={() => onToggleFavourite(match.id)}
          accessibilityRole="button"
          accessibilityState={{ selected: isFavourite }}
          accessibilityLabel={
            isFavourite
              ? `Remove ${matchTitle} from favourites`
              : `Add ${matchTitle} to favourites`
          }>
          <Ionicons
            name={isFavourite ? 'star' : 'star-outline'}
            size={24}
            color={isFavourite ? theme.colors.primary : theme.colors.textSecondary}
          />
        </TouchableOpacity>
      </View>

      <View style={styles.outcomesList}>
        {outcomes.map((item) => (
          <OutcomeEdgeRow
            key={item.outcome}
            analysis={item}
            matchTitle={matchTitle}
            onLogPress={(outcome, odds) => onLogOutcome(match, outcome, odds)}
          />
        ))}
      </View>
    </View>
  );
}

export const MatchPickCard = memo(MatchPickCardComponent);

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    card: {
      backgroundColor: theme.colors.surface,
      borderColor: theme.colors.border,
      borderWidth: theme.layout.borderWidth,
      borderRadius: theme.radii.card,
      paddingHorizontal: theme.spacing.lg,
      paddingVertical: theme.spacing.md,
      gap: theme.spacing.sm,
      marginBottom: theme.spacing.sm,
    },
    fixtureRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: theme.spacing.sm,
    },
    teamsTouchArea: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.lg,
      minHeight: theme.layout.minTouchTarget,
    },
    timeColumn: {
      minWidth: 74,
      justifyContent: 'center',
    },
    timeText: {
      color: theme.colors.textPrimary,
      fontSize: theme.typography.sizes.fixtureTime,
      lineHeight: theme.typography.lineHeights.fixtureTime,
      fontWeight: theme.typography.weights.bold,
      letterSpacing: -0.5,
    },
    stackedTeamsColumn: {
      flex: 1,
      gap: theme.spacing.xs,
    },
    teamLine: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
    },
    teamName: {
      flexShrink: 1,
      color: theme.colors.textPrimary,
      fontSize: theme.typography.sizes.bodyStrong,
      lineHeight: theme.typography.lineHeights.bodyStrong,
      fontWeight: theme.typography.weights.medium,
    },
    starButton: {
      minWidth: theme.layout.minTouchTarget,
      minHeight: theme.layout.minTouchTarget,
      alignItems: 'center',
      justifyContent: 'center',
    },
    outcomesList: {
      borderTopColor: theme.colors.border,
      borderTopWidth: theme.layout.borderWidth,
      paddingTop: theme.spacing.sm,
      gap: theme.spacing.xs,
    },
  });
}
