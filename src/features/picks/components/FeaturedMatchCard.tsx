import React, { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { PillBadge } from '@/components/PillBadge';
import { TeamCrest } from '@/components/TeamCrest';
import { MatchPick, OutcomeKey } from '@/data/types';
import { OutcomeEdgeRow } from '@/features/picks/components/OutcomeEdgeRow';
import { analyzeMatchOutcomes } from '@/lib/calculations';
import { formatKickoffTime, formatShortDayAndMonth } from '@/lib/dateUtils';
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

  return (
    <View style={[styles.card, theme.shadows.card]}>
      {/* Decorative centre pitch line & circle motif behind the hero content */}
      <View style={styles.pitchLineVertical} pointerEvents="none" />
      <View style={styles.pitchCenterCircle} pointerEvents="none" />

      <TouchableOpacity
        style={styles.heroTouchable}
        onPress={() => onPressMatch(match.id)}
        accessibilityRole="button"
        accessibilityLabel={`Match of the week ${matchTitle}. Tap to view detailed breakdown`}
      >
        <View style={styles.topRow}>
          <Text style={styles.featuredLabel}>MATCH OF THE WEEK</Text>
          {match.isDemo ? (
            <PillBadge label="DEMO DATA" variant="gold" />
          ) : (
            <PillBadge label={match.league.toUpperCase()} variant="emerald" />
          )}
        </View>

        <View style={styles.teamsRow}>
          <View style={styles.teamColumn}>
            <TeamCrest teamName={match.home} size="lg" />
            <Text style={styles.teamName} numberOfLines={1}>
              {match.home}
            </Text>
          </View>

          <View style={styles.centerColumn}>
            <Text style={styles.heroTimeText}>{formatKickoffTime(match.date)}</Text>
            <View style={styles.timeUnderline} />
            <Text style={styles.kickoffDateText}>
              {formatShortDayAndMonth(match.date)}
            </Text>
          </View>

          <View style={styles.teamColumn}>
            <TeamCrest teamName={match.away} size="lg" />
            <Text style={styles.teamName} numberOfLines={1}>
              {match.away}
            </Text>
          </View>
        </View>
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
      backgroundColor: theme.colors.surfaceHero,
      borderColor: theme.colors.borderAccent,
      borderWidth: theme.layout.borderWidth,
      borderRadius: theme.radii.card,
      padding: theme.spacing.lg,
      gap: theme.spacing.md,
      marginVertical: theme.spacing.xs,
      overflow: 'hidden',
    },
    pitchLineVertical: {
      position: 'absolute',
      top: 0,
      bottom: 0,
      left: '50%',
      width: 1,
      backgroundColor: theme.colors.border,
      opacity: 0.65,
    },
    pitchCenterCircle: {
      position: 'absolute',
      top: 38,
      left: '50%',
      width: 132,
      height: 132,
      marginLeft: -66,
      borderRadius: theme.radii.pill,
      borderColor: theme.colors.borderAccent,
      borderWidth: 2,
      opacity: 0.45,
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
      color: theme.colors.textSecondary,
      fontSize: theme.typography.sizes.caption,
      fontWeight: theme.typography.weights.semibold,
      letterSpacing: 1.5,
    },
    teamsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: theme.spacing.sm,
    },
    teamColumn: {
      flex: 1,
      alignItems: 'center',
      gap: theme.spacing.sm,
    },
    teamName: {
      color: theme.colors.textPrimary,
      fontSize: theme.typography.sizes.bodyStrong,
      lineHeight: theme.typography.lineHeights.bodyStrong,
      fontWeight: theme.typography.weights.bold,
      textAlign: 'center',
    },
    centerColumn: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: theme.spacing.sm,
      gap: theme.spacing.xs,
    },
    heroTimeText: {
      color: theme.colors.primary,
      fontSize: theme.typography.sizes.heroTime,
      lineHeight: theme.typography.lineHeights.heroTime,
      fontWeight: theme.typography.weights.bold,
      letterSpacing: -1,
    },
    timeUnderline: {
      width: 48,
      height: 1,
      backgroundColor: theme.colors.borderAccent,
    },
    kickoffDateText: {
      color: theme.colors.textSecondary,
      fontSize: theme.typography.sizes.body,
      fontWeight: theme.typography.weights.medium,
    },
    outcomesSection: {
      borderTopColor: theme.colors.border,
      borderTopWidth: theme.layout.borderWidth,
      paddingTop: theme.spacing.sm,
      gap: theme.spacing.xs,
    },
  });
}
