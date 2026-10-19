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
import { MOCK_PICKS_PAYLOAD } from '@/data/mockPicks';
import { picksRepository } from '@/data/picksRepository';
import { useAppStore } from '@/data/store';
import { OutcomeKey } from '@/data/types';
import { OutcomeEdgeRow } from '@/features/picks/components/OutcomeEdgeRow';
import { StatComparisonRow } from '@/features/picks/components/StatComparisonRow';
import { analyzeMatchOutcomes } from '@/lib/calculations';
import { formatShortDayAndTime, formatUpdatedRelative } from '@/lib/dateUtils';
import { AppTheme, useAppTheme } from '@/theme/useAppTheme';

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
  const outcomes = analyzeMatchOutcomes(match.p, match.odds, edgeThreshold);
  const updatedLabel =
    match.updatedAtLabel ?? formatUpdatedRelative(MOCK_PICKS_PAYLOAD.generated_at);

  const homePct = Math.round(match.p[0] * 100);
  const drawPct = Math.round(match.p[1] * 100);
  const awayPct = Math.max(0, 100 - homePct - drawPct);

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
              <Text style={styles.probColHeroPct}>{homePct}%</Text>
              <View style={styles.probIndividualTrack}>
                <View
                  style={[
                    styles.probIndividualFillPrimary,
                    { width: `${Math.min(100, Math.max(8, homePct))}%` },
                  ]}
                />
              </View>
            </View>

            <View style={styles.probCol}>
              <Text style={styles.probColTitle}>Draw</Text>
              <Text style={styles.probColHeroPct}>{drawPct}%</Text>
              <View style={styles.probIndividualTrack}>
                <View
                  style={[
                    styles.probIndividualFillSecondary,
                    { width: `${Math.min(100, Math.max(8, drawPct))}%` },
                  ]}
                />
              </View>
            </View>

            <View style={styles.probCol}>
              <Text style={styles.probColTitle}>Away</Text>
              <Text style={styles.probColHeroPct}>{awayPct}%</Text>
              <View style={styles.probIndividualTrack}>
                <View
                  style={[
                    styles.probIndividualFillSecondary,
                    { width: `${Math.min(100, Math.max(8, awayPct))}%` },
                  ]}
                />
              </View>
            </View>
          </View>

          <View style={styles.probFooterRow}>
            <Text style={styles.updatedMeta}>
              {updatedLabel} •{' '}
              <Text style={styles.demoInline}>
                {match.isDemo
                  ? 'DEMO DATA'
                  : `REF: ${match.reference_source ?? 'PINNACLE'} • POISSON-DC`}
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
  });
}
