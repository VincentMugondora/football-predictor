import React, { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { PillBadge } from '@/components/PillBadge';
import { TeamCrest } from '@/components/TeamCrest';
import { MatchPick, OutcomeKey } from '@/data/types';
import { OutcomeEdgeRow } from '@/features/picks/components/OutcomeEdgeRow';
import { StackedProbBar } from '@/features/picks/components/StackedProbBar';
import { analyzeMatchOutcomes } from '@/lib/calculations';
import { formatShortDayAndTime } from '@/lib/dateUtils';
import { AppTheme, useAppTheme } from '@/theme/useAppTheme';

export interface FeaturedMatchCardProps {
  match: MatchPick;
  edgeThreshold: number;
  onPressMatch: (matchId: string) => void;
  onLogOutcome: (match: MatchPick, outcome: OutcomeKey, odds: number) => void;
}

export function FeaturedMatchCard({
  match,
  edgeThreshold,
  onPressMatch,
  onLogOutcome,
}: FeaturedMatchCardProps) {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const outcomes = useMemo(
    () => analyzeMatchOutcomes(match.p, match.odds, edgeThreshold),
    [match.p, match.odds, edgeThreshold]
  );

  const matchTitle = `${match.home} vs ${match.away}`;

  return (
    <View style={styles.card}>
      <TouchableOpacity
        style={styles.heroTouchable}
        onPress={() => onPressMatch(match.id)}
        accessibilityRole="button"
        accessibilityLabel={`Featured match ${matchTitle}. Tap to view detailed breakdown`}
      >
        <View style={styles.topRow}>
          <Text style={styles.featuredLabel}>FEATURED MATCH</Text>
          {match.isDemo ? <PillBadge label="DEMO DATA" variant="gold" /> : null}
        </View>

        <View style={styles.teamsRow}>
          <View style={styles.teamColumn}>
            <TeamCrest teamName={match.home} size="lg" />
            <Text style={styles.teamName}>{match.home}</Text>
          </View>

          <View style={styles.centerColumn}>
            <Text style={styles.kickoffText}>{formatShortDayAndTime(match.date)}</Text>
            <Text style={styles.vsText}>VS</Text>
            <Text style={styles.leagueSub}>{match.league}</Text>
          </View>

          <View style={styles.teamColumn}>
            <TeamCrest teamName={match.away} size="lg" />
            <Text style={styles.teamName}>{match.away}</Text>
          </View>
        </View>

        <StackedProbBar probabilities={match.p} />
      </TouchableOpacity>

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
    </View>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    card: {
      backgroundColor: theme.colors.surfaceHero,
      borderColor: theme.colors.borderAccent,
      borderWidth: theme.layout.borderWidth,
      borderRadius: theme.radii.card,
      padding: theme.spacing.lg,
      gap: theme.spacing.md,
      marginVertical: theme.spacing.xs,
    },
    heroTouchable: {
      gap: theme.spacing.md,
    },
    topRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    featuredLabel: {
      color: theme.colors.primary,
      fontSize: theme.typography.sizes.badge,
      fontWeight: theme.typography.weights.bold,
      letterSpacing: 0.6,
    },
    teamsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: theme.spacing.xs,
    },
    teamColumn: {
      flex: 1,
      alignItems: 'center',
      gap: theme.spacing.sm,
    },
    teamName: {
      color: theme.colors.textPrimary,
      fontSize: theme.typography.sizes.bodyStrong,
      fontWeight: theme.typography.weights.semibold,
      textAlign: 'center',
    },
    centerColumn: {
      alignItems: 'center',
      gap: theme.spacing.xs,
      paddingHorizontal: theme.spacing.sm,
    },
    kickoffText: {
      color: theme.colors.textSecondary,
      fontSize: theme.typography.sizes.body,
      fontWeight: theme.typography.weights.medium,
    },
    vsText: {
      color: theme.colors.textPrimary,
      fontSize: theme.typography.sizes.screenTitle,
      fontWeight: theme.typography.weights.bold,
    },
    leagueSub: {
      color: theme.colors.textMuted,
      fontSize: theme.typography.sizes.caption,
    },
    outcomesSection: {
      borderTopColor: theme.colors.borderAccent,
      borderTopWidth: theme.layout.borderWidth,
      paddingTop: theme.spacing.sm,
      gap: theme.spacing.xs,
    },
  });
}
