import { router, useLocalSearchParams } from 'expo-router';
import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppHeader } from '@/components/AppHeader';
import { DisclaimerFooter } from '@/components/DisclaimerFooter';
import { EmptyState } from '@/components/EmptyState';
import { FormBadge } from '@/components/FormBadge';
import { PillBadge } from '@/components/PillBadge';
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
          actionLabel="Back to Picks"
          onAction={() => router.replace('/')}
        />
      </ScreenContainer>
    );
  }

  const matchTitle = `${match.home} vs ${match.away}`;
  const outcomes = analyzeMatchOutcomes(match.p, match.odds, edgeThreshold);
  const updatedLabel = formatUpdatedRelative(MOCK_PICKS_PAYLOAD.generated_at);

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
        contentContainerStyle={styles.scrollContent}>
        {/* Hero Card matching Image 1 */}
        <View style={styles.heroCard}>
          <View style={styles.heroBadgeRow}>
            {match.isDemo ? <PillBadge label="DEMO DATA" variant="gold" /> : null}
          </View>
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

        {/* Recent form card matching Image 1 */}
        {match.homeForm && match.awayForm ? (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Recent form</Text>
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

        {/* Match probabilities + break-even + edge card matching Image 1 */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Match probabilities</Text>
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
          <Text style={styles.updatedMeta}>
            {updatedLabel} • <Text style={styles.demoInline}>DEMO DATA</Text>
          </Text>
        </View>

        {/* Key stats (per game) card matching Image 1 */}
        {match.stats ? (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Key stats (per game)</Text>
            <View style={styles.statsClubsSubheader}>
              <Text style={styles.statsClubLabel}>{match.home}</Text>
              <Text style={styles.statsClubLabel}>{match.away}</Text>
            </View>
            <StatComparisonRow
              label="Goals per game"
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

        {/* Our take card matching Image 1 */}
        {match.ourTake ? (
          <View style={styles.sectionCard}>
            <View style={styles.ourTakeHeader}>
              <View style={styles.ourTakeTitleRow}>
                <View style={styles.chartIconBox}>
                  <Text style={styles.chartIconText}>▮▮▮</Text>
                </View>
                <Text style={styles.sectionTitle}>Our take</Text>
              </View>
              {match.isDemo ? <PillBadge label="DEMO DATA" variant="gold" /> : null}
            </View>
            <Text style={styles.ourTakeBody}>{match.ourTake}</Text>
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
      backgroundColor: theme.colors.surfaceHero,
      borderColor: theme.colors.borderAccent,
      borderWidth: theme.layout.borderWidth,
      borderRadius: theme.radii.card,
      padding: theme.spacing.lg,
      gap: theme.spacing.sm,
      marginTop: theme.spacing.xs,
    },
    heroBadgeRow: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
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
      fontSize: theme.typography.sizes.bodyStrong,
      fontWeight: theme.typography.weights.semibold,
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
    sectionTitle: {
      color: theme.colors.textPrimary,
      fontSize: theme.typography.sizes.sectionTitle,
      lineHeight: theme.typography.lineHeights.sectionTitle,
      fontWeight: theme.typography.weights.semibold,
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
    probabilitiesList: {
      gap: theme.spacing.sm,
    },
    updatedMeta: {
      color: theme.colors.textMuted,
      fontSize: theme.typography.sizes.caption,
    },
    demoInline: {
      color: theme.colors.badgeGold,
      fontWeight: theme.typography.weights.bold,
    },
    statsClubsSubheader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    statsClubLabel: {
      color: theme.colors.textSecondary,
      fontSize: theme.typography.sizes.body,
    },
    ourTakeHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    ourTakeTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
    },
    chartIconBox: {
      width: 28,
      height: 28,
      borderRadius: theme.radii.xs,
      backgroundColor: theme.colors.primaryMuted,
      alignItems: 'center',
      justifyContent: 'center',
    },
    chartIconText: {
      color: theme.colors.primary,
      fontSize: theme.typography.sizes.badge,
      fontWeight: theme.typography.weights.bold,
    },
    ourTakeBody: {
      color: theme.colors.textPrimary,
      fontSize: theme.typography.sizes.body,
      lineHeight: theme.typography.lineHeights.body,
    },
  });
}
