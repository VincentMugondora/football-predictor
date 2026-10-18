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
  const styles = useMemo(() => createStyles(theme, isFavourite), [theme, isFavourite]);
  const outcomes = useMemo(
    () => analyzeMatchOutcomes(match.p, match.odds, edgeThreshold),
    [match.p, match.odds, edgeThreshold]
  );

  const matchTitle = `${match.home} vs ${match.away}`;

  return (
    <View style={styles.card}>
      <View style={styles.fixtureRow}>
        <TouchableOpacity
          style={styles.teamsTouchArea}
          onPress={() => onPressMatch(match.id)}
          accessibilityRole="button"
          accessibilityLabel={`View match details for ${matchTitle}, kickoff ${formatKickoffTime(match.date)}`}
        >
          <View style={styles.homeGroup}>
            <TeamCrest teamName={match.home} size="sm" />
            <Text style={styles.teamName} numberOfLines={1}>
              {match.home}
            </Text>
          </View>

          <View style={styles.timeBox}>
            <Text style={styles.timeText}>{formatKickoffTime(match.date)}</Text>
            <Text style={styles.leagueText}>{match.league}</Text>
          </View>

          <View style={styles.awayGroup}>
            <Text style={[styles.teamName, styles.awayName]} numberOfLines={1}>
              {match.away}
            </Text>
            <TeamCrest teamName={match.away} size="sm" />
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
          }
        >
          <Text style={styles.starIcon}>{isFavourite ? '★' : '☆'}</Text>
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

function createStyles(theme: AppTheme, isFavourite: boolean) {
  return StyleSheet.create({
    card: {
      backgroundColor: theme.colors.surface,
      borderColor: theme.colors.border,
      borderWidth: theme.layout.borderWidth,
      borderRadius: theme.radii.card,
      padding: theme.spacing.md,
      gap: theme.spacing.sm,
      marginBottom: theme.spacing.md,
    },
    fixtureRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.xs,
    },
    teamsTouchArea: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      minHeight: theme.layout.minTouchTarget,
      gap: theme.spacing.xs,
    },
    homeGroup: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
    },
    awayGroup: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-end',
      gap: theme.spacing.sm,
    },
    teamName: {
      flexShrink: 1,
      color: theme.colors.textPrimary,
      fontSize: theme.typography.sizes.bodyStrong,
      fontWeight: theme.typography.weights.semibold,
    },
    awayName: {
      textAlign: 'right',
    },
    timeBox: {
      alignItems: 'center',
      paddingHorizontal: theme.spacing.xs,
    },
    timeText: {
      color: theme.colors.textSecondary,
      fontSize: theme.typography.sizes.body,
      fontWeight: theme.typography.weights.medium,
    },
    leagueText: {
      color: theme.colors.textMuted,
      fontSize: theme.typography.sizes.badge,
    },
    starButton: {
      minWidth: theme.layout.minTouchTarget,
      minHeight: theme.layout.minTouchTarget,
      alignItems: 'center',
      justifyContent: 'center',
    },
    starIcon: {
      color: isFavourite ? theme.colors.badgeGold : theme.colors.textSecondary,
      fontSize: theme.typography.sizes.screenTitle,
    },
    outcomesList: {
      borderTopColor: theme.colors.border,
      borderTopWidth: theme.layout.borderWidth,
      paddingTop: theme.spacing.sm,
      gap: theme.spacing.xs,
    },
  });
}
