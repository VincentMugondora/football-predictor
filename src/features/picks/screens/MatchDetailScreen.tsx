import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { AppHeader } from '@/components/AppHeader';
import { DisclaimerFooter } from '@/components/DisclaimerFooter';
import { EmptyState } from '@/components/EmptyState';
import { FormBadge } from '@/components/FormBadge';
import { ScreenContainer } from '@/components/ScreenContainer';
import { TeamCrest } from '@/components/TeamCrest';
import { picksRepository } from '@/data/picksRepository';
import { useAppStore } from '@/data/store';
import { OutcomeKey } from '@/data/types';
import { OutcomeEdgeRow } from '@/features/picks/components/OutcomeEdgeRow';
import { StatComparisonRow } from '@/features/picks/components/StatComparisonRow';
import { analyzeMatchOutcomes } from '@/lib/calculations';
import { formatShortDayAndTime } from '@/lib/dateUtils';
import { AppTheme, useAppTheme } from '@/theme/useAppTheme';

const GOAL_TIME_WINDOWS = ['0-15', '16-30', '31-45+', '46-60', '61-75', '76-90+'] as const;

export function MatchDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [showOddsDetail, setShowOddsDetail] = useState(false);

  const edgeThreshold = useAppStore((s) => s.settings.edgeThreshold);
  const setDraftBet = useAppStore((s) => s.setDraftBet);

  const match = useMemo(() => {
    if (!id) {
      return undefined;
    }
    return picksRepository.getMatchById(id);
  }, [id]);

  if (!match) {
    return (
      <ScreenContainer>
        <AppHeader title="Match Detail" showBack />
        <EmptyState
          title="Match not found"
          message="This fixture could not be found in the local cache."
          actionLabel="Back to Matches"
          onAction={() => router.replace('/')}
        />
      </ScreenContainer>
    );
  }

  const matchTitle = `${match.home} vs ${match.away}`;
  const minuteWindows = match.timing?.windows ?? null;
  const outcomes = analyzeMatchOutcomes(match.p, match.odds, edgeThreshold);
  const updatedLabel =
    match.updatedAtLabel ?? 'Live data';

  const winnerProbabilities = match.winner?.p ?? match.p;
  const winnerPickLabel = match.winner?.pick === 'too close to call'
    ? 'Too close to call'
    : match.winner?.pick === 'home' ? `${match.home} most likely`
      : match.winner?.pick === 'away' ? `${match.away} most likely`
        : match.winner?.pick === 'draw' ? 'Draw most likely' : null;

  const handleLogOutcome = (outcome: OutcomeKey, odds: number) => {
    setDraftBet({
      match: matchTitle,
      pick: outcome,
      odds,
      tag: match.league,
    });
    router.push('/bet-log');
  };

  return (
    <ScreenContainer>
      <AppHeader title={matchTitle} showBack />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Card 1: Match Hero Card */}
        <View style={[styles.heroCard, theme.shadows.card]}>
          <View style={styles.heroTeamsRow}>
            <View style={styles.heroTeamCol}>
              <TeamCrest teamName={match.home} size="lg" />
              <Text style={styles.heroTeamName}>{match.home}</Text>
            </View>
            <View style={styles.heroCenterCol}>
              <Text style={styles.heroDateText}>{formatShortDayAndTime(match.date)}</Text>
            </View>
            <View style={styles.heroTeamCol}>
              <TeamCrest teamName={match.away} size="lg" />
              <Text style={styles.heroTeamName}>{match.away}</Text>
            </View>
          </View>
        </View>

        {/* Card 2: RECENT FORM */}
        {match.homeForm && match.awayForm ? (
          <View style={[styles.sectionCard, theme.shadows.card]}>
            <Text style={styles.sectionHeaderCaps}>RECENT FORM</Text>
            <View style={styles.formSplitRow}>
              <View style={styles.formGroup}>
                {match.homeForm.map((res, idx) => (
                  <FormBadge key={`home-form-${idx}`} result={res} />
                ))}
              </View>
              <View style={styles.verticalDivider} />
              <View style={styles.formGroup}>
                {match.awayForm.map((res, idx) => (
                  <FormBadge key={`away-form-${idx}`} result={res} />
                ))}
              </View>
            </View>
          </View>
        ) : null}

        {/* Card 3: MATCH OUTCOME PROBABILITIES */}
        <View style={[styles.sectionCard, theme.shadows.card]}>
          <Text style={styles.sectionHeaderCaps}>MATCH OUTCOME PROBABILITIES</Text>

          <View style={styles.probColumnsRow}>
            <View style={styles.probCol}>
              <Text style={styles.probColTitle}>Home</Text>
              <Text style={styles.probColHeroPct}>{Math.round(winnerProbabilities[0] * 100)}%</Text>
              <View style={styles.probIndividualTrack}>
                <View
                  style={[
                    styles.probIndividualFillPrimary,
                    { width: `${Math.min(100, Math.max(0, winnerProbabilities[0] * 100))}%` },
                  ]}
                />
              </View>
            </View>

            <View style={styles.probCol}>
              <Text style={styles.probColTitle}>Draw</Text>
              <Text style={styles.probColHeroPct}>{Math.round(winnerProbabilities[1] * 100)}%</Text>
              <View style={styles.probIndividualTrack}>
                <View
                  style={[
                    styles.probIndividualFillSecondary,
                    { width: `${Math.min(100, Math.max(0, winnerProbabilities[1] * 100))}%` },
                  ]}
                />
              </View>
            </View>

            <View style={styles.probCol}>
              <Text style={styles.probColTitle}>Away</Text>
              <Text style={styles.probColHeroPct}>{Math.round(winnerProbabilities[2] * 100)}%</Text>
              <View style={styles.probIndividualTrack}>
                <View
                  style={[
                    styles.probIndividualFillSecondary,
                    { width: `${Math.min(100, Math.max(0, winnerProbabilities[2] * 100))}%` },
                  ]}
                />
              </View>
            </View>
          </View>

          {match.winner ? (
            <Text style={styles.explanationText}>
              {`Model pick: ${winnerPickLabel} · ${match.winner.confidence} confidence. These are chances for home win, draw, and away win; they are not guarantees.`}
            </Text>
          ) : null}

          <View style={styles.probFooterRow}>
            <Text style={styles.updatedMeta}>
              {updatedLabel} •{' '}
              <Text style={styles.demoInline}>
                {match.reference_source ? `REF: ${match.reference_source}` : 'ODDS UNAVAILABLE'} • POISSON-DC
              </Text>
            </Text>

            <TouchableOpacity
              style={styles.logBetToggle}
              onPress={() => setShowOddsDetail((prev) => !prev)}
              accessibilityRole="button"
              accessibilityLabel="Toggle bookmaker odds and log bet actions"
            >
              <Text style={styles.logBetToggleText}>
                {showOddsDetail ? 'Hide Odds' : 'Odds & Log Bet'}
              </Text>
              <Ionicons
                name={showOddsDetail ? 'chevron-up' : 'chevron-down'}
                size={14}
                color={theme.colors.primary}
              />
            </TouchableOpacity>
          </View>

          {showOddsDetail ? (
            <View style={styles.probabilitiesList}>
              {outcomes.map((item) => (
                <OutcomeEdgeRow
                  key={item.outcome}
                  analysis={item}
                  matchTitle={matchTitle}
                  onLogPress={handleLogOutcome}
                />
              ))}
            </View>
          ) : null}
        </View>

        {match.goals ? (
          <View style={[styles.sectionCard, theme.shadows.card]}>
            <Text style={styles.sectionHeaderCaps}>GOALS AND SCORELINES</Text>
            <Text style={styles.expectedGoalsText}>
              {`${match.home} ${match.goals.exp_home.toFixed(2)} expected · ${match.away} ${match.goals.exp_away.toFixed(2)} expected · ${match.goals.exp_total.toFixed(2)} total`}
            </Text>
            <Text style={styles.explanationText}>
              Expected goals are model averages across many similar matches, not a promised final score.
            </Text>

            <Text style={styles.rowTitle}>Chance of total match goals</Text>
            <Text style={styles.explanationText}>Each value is the chance the match ends with exactly that many goals.</Text>
            <Text style={styles.probabilityText}>
              {match.goals.p_total.map((value, index) => `${index === 4 ? '4+' : index}: ${Math.round(value * 100)}%`).join('  ·  ')}
            </Text>

            <Text style={styles.rowTitle}>Over goal lines</Text>
            <Text style={styles.explanationText}>Chance that combined goals finish above each line.</Text>
            {(['0.5', '1.5', '2.5', '3.5'] as const).map((line) => (
              <ProbabilityRow key={line} label={`Over ${line}`} value={match.goals!.over[line]} styles={styles} />
            ))}
            <ProbabilityRow label="Both teams to score" value={match.goals.btts} styles={styles} />
            <Text style={styles.explanationText}>Chance both clubs score at least once.</Text>
            <ProbabilityRow label={`${match.home} clean sheet`} value={match.goals.clean_sheet[0]} styles={styles} />
            <ProbabilityRow label={`${match.away} clean sheet`} value={match.goals.clean_sheet[1]} styles={styles} />
            <Text style={styles.explanationText}>A clean sheet means that team concedes no goals.</Text>

            <Text style={styles.rowTitle}>Three most likely scorelines</Text>
            {match.goals.top_scores.map((item) => (
              <Text key={item.score} style={styles.probabilityText}>
                {`${item.score} · ${Math.round(item.probability * 100)}% chance`}
              </Text>
            ))}
            <Text style={styles.explanationText}>Exact scores remain uncertain even when they rank highest.</Text>
          </View>
        ) : null}

        {match.timing ? (
          <View style={[styles.sectionCard, theme.shadows.card]}>
            <Text style={styles.sectionHeaderCaps}>GOAL TIMING</Text>
            {minuteWindows ? (
              <>
                <Text style={styles.rowTitle}>15-minute windows</Text>
                <Text style={styles.explanationText}>Each bar is the chance that team scores at least once during that window. Expected goals are the average goals projected in that interval.</Text>
                {GOAL_TIME_WINDOWS.map((window) => (
                  <View key={window} style={styles.probabilitiesList}>
                    <Text style={styles.rowTitle}>{window} minutes</Text>
                    <Text style={styles.probabilityText}>{`${match.home}: ${minuteWindows.home[window].expected_goals.toFixed(2)} expected goals`}</Text>
                    <ProbabilityRow label={`${match.home}: scores in ${window}`} value={minuteWindows.home[window].p_at_least_one} styles={styles} />
                    <Text style={styles.probabilityText}>{`${match.away}: ${minuteWindows.away[window].expected_goals.toFixed(2)} expected goals`}</Text>
                    <ProbabilityRow label={`${match.away}: scores in ${window}`} value={minuteWindows.away[window].p_at_least_one} styles={styles} />
                  </View>
                ))}
                <ProbabilityRow label="First goal before minute 30" value={minuteWindows.p_first_goal_before_30} styles={styles} />
                {!minuteWindows.team_specific_signal ? (
                  <Text style={styles.timingNote}>league average, no team-specific signal yet</Text>
                ) : null}
              </>
            ) : match.timing.halves ? (
              <>
                <Text style={styles.rowTitle}>Expected goals by half</Text>
                <Text style={styles.probabilityText}>{`${match.home}: first half ${match.timing.halves.home.first.toFixed(2)}, second half ${match.timing.halves.home.second.toFixed(2)}`}</Text>
                <Text style={styles.probabilityText}>{`${match.away}: first half ${match.timing.halves.away.first.toFixed(2)}, second half ${match.timing.halves.away.second.toFixed(2)}`}</Text>
                <Text style={styles.explanationText}>These split each team’s expected goals using historical halftime scores.</Text>
                <ProbabilityRow label="At least one first-half goal" value={match.timing.halves.p_first_half_goal} styles={styles} />
                <Text style={styles.explanationText}>Chance either team scores before halftime.</Text>
              </>
            ) : (
              <Text style={styles.explanationText}>No validated halftime scores are available for this league, so timing is not estimated.</Text>
            )}
            <Text style={styles.timingNote}>{match.timing.note}</Text>
          </View>
        ) : null}

        {/* Card 4: KEY STATS (PER GAME) */}
        {match.stats ? (
          <View style={[styles.sectionCard, theme.shadows.card]}>
            <Text style={styles.sectionHeaderCaps}>KEY STATS (PER GAME)</Text>
            <StatComparisonRow
              label="Goals/game"
              homeValue={match.stats.goalsPerGame[0].toFixed(1)}
              awayValue={match.stats.goalsPerGame[1].toFixed(1)}
            />
            <StatComparisonRow
              label="Shots"
              homeValue={String(match.stats.shots[0])}
              awayValue={String(match.stats.shots[1])}
            />
            <StatComparisonRow
              label="Possession"
              homeValue={`${match.stats.possession[0]}%`}
              awayValue={`${match.stats.possession[1]}%`}
              isLast
            />
          </View>
        ) : null}

        {/* Card 5: OUR TAKE */}
        {match.ourTake ? (
          <View style={[styles.ourTakeCard, theme.shadows.card]}>
            <View style={styles.ourTakeCircleIcon}>
              <Ionicons name="stats-chart" size={22} color={theme.colors.textSecondary} />
            </View>
            <View style={styles.ourTakeContentCol}>
              <Text style={styles.sectionHeaderCaps}>OUR TAKE</Text>
              <Text style={styles.ourTakeBody}>{match.ourTake}</Text>
            </View>
          </View>
        ) : null}

        <DisclaimerFooter />
        <Text style={styles.explanationText}>
          Statistical estimates, not certainties. Exact scores and goal minutes are hard to predict.
        </Text>
      </ScrollView>
    </ScreenContainer>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    scrollContent: {
      gap: theme.spacing.md,
      paddingBottom: theme.spacing.xxl,
    },
    heroCard: {
      backgroundColor: theme.colors.surface,
      borderColor: theme.colors.border,
      borderWidth: theme.layout.borderWidth,
      borderRadius: theme.radii.card,
      padding: theme.spacing.lg,
      marginTop: theme.spacing.xs,
    },
    heroTeamsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: theme.spacing.xs,
    },
    heroTeamCol: {
      flex: 1,
      alignItems: 'center',
      gap: theme.spacing.sm,
    },
    heroTeamName: {
      color: theme.colors.textPrimary,
      fontSize: theme.typography.sizes.statValue,
      lineHeight: theme.typography.lineHeights.statValue,
      fontWeight: theme.typography.weights.bold,
      textAlign: 'center',
    },
    heroCenterCol: {
      paddingHorizontal: theme.spacing.sm,
      alignItems: 'center',
    },
    heroDateText: {
      color: theme.colors.textSecondary,
      fontSize: theme.typography.sizes.body,
      fontWeight: theme.typography.weights.medium,
    },
    sectionCard: {
      backgroundColor: theme.colors.surface,
      borderColor: theme.colors.border,
      borderWidth: theme.layout.borderWidth,
      borderRadius: theme.radii.card,
      padding: theme.spacing.lg,
      gap: theme.spacing.md,
    },
    sectionHeaderCaps: {
      color: theme.colors.textSecondary,
      fontSize: theme.typography.sizes.caption,
      fontWeight: theme.typography.weights.bold,
      letterSpacing: 1.5,
    },
    formSplitRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: theme.spacing.sm,
    },
    formGroup: {
      flex: 1,
      flexDirection: 'row',
      justifyContent: 'space-around',
      alignItems: 'center',
    },
    verticalDivider: {
      width: 1,
      height: 28,
      backgroundColor: theme.colors.border,
    },
    probColumnsRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: theme.spacing.md,
      paddingVertical: theme.spacing.xs,
    },
    probCol: {
      flex: 1,
      alignItems: 'center',
      gap: theme.spacing.xs,
    },
    probColTitle: {
      color: theme.colors.textPrimary,
      fontSize: theme.typography.sizes.body,
      fontWeight: theme.typography.weights.medium,
    },
    probColHeroPct: {
      color: theme.colors.primary,
      fontSize: theme.typography.sizes.probHero,
      lineHeight: theme.typography.lineHeights.probHero,
      fontWeight: theme.typography.weights.bold,
    },
    probIndividualTrack: {
      width: '100%',
      height: theme.layout.progressBarHeight,
      borderRadius: theme.radii.pill,
      backgroundColor: theme.colors.neutralBarTrack,
      overflow: 'hidden',
      marginTop: theme.spacing.xxs,
    },
    probIndividualFillPrimary: {
      height: '100%',
      backgroundColor: theme.colors.primary,
      borderRadius: theme.radii.pill,
    },
    probIndividualFillSecondary: {
      height: '100%',
      backgroundColor: theme.colors.probBarDraw,
      borderRadius: theme.radii.pill,
    },
    probFooterRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingTop: theme.spacing.xs,
    },
    updatedMeta: {
      color: theme.colors.textSecondary,
      fontSize: theme.typography.sizes.caption,
    },
    demoInline: {
      color: theme.colors.badgeGold,
      fontWeight: theme.typography.weights.bold,
    },
    logBetToggle: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.xs,
      backgroundColor: theme.colors.primaryMuted,
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: theme.spacing.xs,
      borderRadius: theme.radii.pill,
    },
    logBetToggleText: {
      color: theme.colors.primary,
      fontSize: theme.typography.sizes.caption,
      fontWeight: theme.typography.weights.semibold,
    },
    probabilitiesList: {
      borderTopColor: theme.colors.border,
      borderTopWidth: theme.layout.borderWidth,
      paddingTop: theme.spacing.sm,
      gap: theme.spacing.sm,
    },
    ourTakeCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.colors.surface,
      borderColor: theme.colors.border,
      borderWidth: theme.layout.borderWidth,
      borderRadius: theme.radii.card,
      padding: theme.spacing.lg,
      gap: theme.spacing.md,
    },
    ourTakeCircleIcon: {
      width: 48,
      height: 48,
      borderRadius: theme.radii.pill,
      backgroundColor: theme.colors.surfaceElevated,
      alignItems: 'center',
      justifyContent: 'center',
    },
    ourTakeContentCol: {
      flex: 1,
      gap: theme.spacing.xs,
    },
    ourTakeBody: {
      color: theme.colors.textPrimary,
      fontSize: theme.typography.sizes.bodyStrong,
      lineHeight: theme.typography.lineHeights.bodyStrong,
    },
    expectedGoalsText: {
      color: theme.colors.textPrimary,
      fontSize: theme.typography.sizes.bodyStrong,
      lineHeight: theme.typography.lineHeights.bodyStrong,
      fontWeight: theme.typography.weights.semibold,
    },
    rowTitle: {
      color: theme.colors.textPrimary,
      fontSize: theme.typography.sizes.bodyStrong,
      fontWeight: theme.typography.weights.semibold,
      marginTop: theme.spacing.xs,
    },
    probabilityText: {
      color: theme.colors.textPrimary,
      fontSize: theme.typography.sizes.body,
      lineHeight: theme.typography.lineHeights.body,
    },
    explanationText: {
      color: theme.colors.textSecondary,
      fontSize: theme.typography.sizes.caption,
      lineHeight: theme.typography.lineHeights.caption,
    },
    timingNote: {
      color: theme.colors.textPrimary,
      backgroundColor: theme.colors.surfaceElevated,
      fontSize: theme.typography.sizes.caption,
      lineHeight: theme.typography.lineHeights.caption,
      padding: theme.spacing.sm,
      borderRadius: theme.radii.card,
    },
    probabilityRow: {
      gap: theme.spacing.xs,
    },
    probabilityRowHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    probabilityTrack: {
      width: '100%',
      height: theme.layout.progressBarHeight,
      borderRadius: theme.radii.pill,
      backgroundColor: theme.colors.neutralBarTrack,
      overflow: 'hidden',
    },
    probabilityFill: {
      height: '100%',
      backgroundColor: theme.colors.primary,
      borderRadius: theme.radii.pill,
    },
  });
}

function ProbabilityRow({
  label,
  value,
  styles,
}: {
  label: string;
  value: number;
  styles: ReturnType<typeof createStyles>;
}) {
  const percent = Math.round(value * 100);
  return (
    <View style={styles.probabilityRow} accessibilityLabel={`${label}: ${percent} percent`}>
      <View style={styles.probabilityRowHeader}>
        <Text style={styles.probabilityText}>{label}</Text>
        <Text style={styles.probabilityText}>{percent}%</Text>
      </View>
      <View style={styles.probabilityTrack}>
        <View style={[styles.probabilityFill, { width: `${Math.max(0, Math.min(100, percent))}%` }]} />
      </View>
    </View>
  );
}
