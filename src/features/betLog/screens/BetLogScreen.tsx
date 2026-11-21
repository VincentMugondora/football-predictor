import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  ListRenderItemInfo,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { AppHeader } from '@/components/AppHeader';
import { DisclaimerFooter } from '@/components/DisclaimerFooter';
import { EmptyState } from '@/components/EmptyState';
import { ScreenContainer } from '@/components/ScreenContainer';
import { SegmentedControl } from '@/components/SegmentedControl';
import { useAppStore } from '@/data/store';
import { BetRecord, MatchResultComparison } from '@/data/types';
import { BetFormModal } from '@/features/betLog/components/BetFormModal';
import { BetRowCard } from '@/features/betLog/components/BetRowCard';
import { PredictionComparisonCard } from '@/features/betLog/components/PredictionComparisonCard';
import { useBetForm } from '@/features/betLog/hooks/useBetForm';
import { usePicksScreen } from '@/features/picks/hooks/usePicksScreen';
import { useSummaryMetrics } from '@/features/summary/hooks/useSummaryMetrics';
import { sanitizeComparisons } from '@/lib/historyStats';
import { AppTheme, useAppTheme } from '@/theme/useAppTheme';

type ResultsTabMode = 'comparisons' | 'bets';

const TAB_OPTIONS = [
  {
    value: 'comparisons' as const,
    label: 'How we did',
    accessibilityLabel: 'Show pre-match model predictions compared with actual results',
  },
  {
    value: 'bets' as const,
    label: 'My bets',
    accessibilityLabel: 'Show your logged bets and bankroll tracker',
  },
];

function signedMoney(value: number): string {
  const sign = value > 0 ? '+' : value < 0 ? '−' : '';
  return `${sign}$${Math.abs(value).toFixed(2)}`;
}

export function BetLogScreen() {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [tabMode, setTabMode] = useState<ResultsTabMode>('comparisons');
  const { payload } = usePicksScreen();
  const comparisons = useMemo(
    (): MatchResultComparison[] => sanitizeComparisons(payload?.recent_comparisons),
    [payload]
  );
  const bets = useAppStore((s) => s.bets);
  const updateBetResult = useAppStore((s) => s.updateBetResult);
  const reconcileBetsWithResults = useAppStore((s) => s.reconcileBetsWithResults);
  const deleteBet = useAppStore((s) => s.deleteBet);
  const metrics = useSummaryMetrics();
  const form = useBetForm();
  const activeTab: ResultsTabMode = form.isFormOpen ? 'bets' : tabMode;

  // Settle Pending bets whose match appears in the published real results.
  useEffect(() => {
    if (comparisons.length > 0) {
      reconcileBetsWithResults(comparisons);
    }
  }, [comparisons, reconcileBetsWithResults]);

  const tally = useMemo(() => {
    const withMargin = comparisons.filter((c) => typeof c.hit_margin === 'boolean');
    const withScore = comparisons.filter((c) => typeof c.hit_score === 'boolean');
    const withBook = comparisons.filter((c) => c.book_favourite);
    return {
      winner: comparisons.filter((c) => c.correct).length,
      margin: withMargin.filter((c) => c.hit_margin).length,
      marginN: withMargin.length,
      score: withScore.filter((c) => c.hit_score).length,
      scoreN: withScore.length,
      book: withBook.filter((c) => c.book_correct).length,
      bookN: withBook.length,
    };
  }, [comparisons]);

  const settled = bets.filter((b) => b.result === 'Win' || b.result === 'Loss');
  const won = settled.filter((b) => b.result === 'Win').length;
  const pendingCount = bets.filter((b) => b.result === 'Pending').length;

  const betKeyExtractor = useCallback((item: BetRecord) => item.id, []);
  const compKeyExtractor = useCallback((item: MatchResultComparison) => item.id, []);
  const renderBetItem = useCallback(
    ({ item }: ListRenderItemInfo<BetRecord>) => (
      <BetRowCard bet={item} onChangeResult={updateBetResult} onDelete={deleteBet} />
    ),
    [updateBetResult, deleteBet]
  );
  const renderComparisonItem = useCallback(
    ({ item }: ListRenderItemInfo<MatchResultComparison>) => <PredictionComparisonCard item={item} />,
    []
  );

  const handleTabChange = useCallback(
    (next: ResultsTabMode) => {
      if (next === 'comparisons' && form.isFormOpen) {
        form.closeForm();
      }
      setTabMode(next);
    },
    [form]
  );

  const listHeader = (
    <View style={styles.headerBlock}>
      <View style={styles.titleBlock}>
        <Text style={styles.title} accessibilityRole="header">
          Results
        </Text>
        <Text style={styles.subtitle}>Real scores against our predictions, and your own bets</Text>
      </View>

      <SegmentedControl
        options={TAB_OPTIONS}
        value={activeTab}
        onChange={handleTabChange}
        accessibilityLabel="Choose results view"
      />

      {activeTab === 'comparisons' ? (
        <>
          <View style={styles.summaryCard} accessible accessibilityLabel={`Right winner in ${tally.winner} of ${comparisons.length} recent matches`}>
            <View style={styles.summaryGrid}>
              <View style={styles.summaryCell}>
                <Text style={styles.summaryLabel}>Right winner</Text>
                <Text style={styles.summaryValueLime}>
                  {tally.winner}
                  <Text style={styles.summaryOf}> of {comparisons.length}</Text>
                </Text>
              </View>
              <View style={styles.summaryCell}>
                <Text style={styles.summaryLabel}>Right margin</Text>
                <Text style={styles.summaryValue}>
                  {tally.margin}
                  <Text style={styles.summaryOf}> of {tally.marginN}</Text>
                </Text>
              </View>
              <View style={styles.summaryCell}>
                <Text style={styles.summaryLabel}>Exact score</Text>
                <Text style={styles.summaryValue}>
                  {tally.score}
                  <Text style={styles.summaryOf}> of {tally.scoreN}</Text>
                </Text>
              </View>
            </View>
            {tally.bookN > 0 ? (
              <Text style={styles.summaryNote}>
                Bookmakers’ favourite won {tally.book} of {tally.bookN}. Small samples swing a lot.
              </Text>
            ) : null}
          </View>
          <Text style={styles.sectionTitle} accessibilityRole="header">
            Finished matches · {comparisons.length}
          </Text>
        </>
      ) : (
        <>
          <TouchableOpacity
            style={styles.summaryCard}
            onPress={() => router.push('/summary')}
            accessibilityRole="button"
            accessibilityLabel={`Profit ${signedMoney(metrics.totalProfit)}, won ${won} of ${settled.length}. Opens full summary`}
          >
            <View style={styles.summaryGrid}>
              <View style={styles.summaryCell}>
                <Text style={styles.summaryLabel}>Profit</Text>
                <Text
                  style={[
                    styles.summaryValue,
                    metrics.totalProfit > 0 ? styles.positive : metrics.totalProfit < 0 ? styles.negative : null,
                  ]}
                >
                  {signedMoney(metrics.totalProfit)}
                </Text>
              </View>
              <View style={styles.summaryCell}>
                <Text style={styles.summaryLabel}>Won</Text>
                <Text style={styles.summaryValue}>
                  {won}
                  <Text style={styles.summaryOf}> of {settled.length}</Text>
                </Text>
              </View>
              <View style={styles.summaryCell}>
                <Text style={styles.summaryLabel}>Return</Text>
                <Text style={styles.summaryValue}>
                  {metrics.roi >= 0 ? '+' : '−'}
                  {Math.abs(metrics.roi * 100).toFixed(1)}%
                </Text>
              </View>
            </View>
            <View style={styles.summaryLink}>
              <Text style={styles.summaryLinkText}>See full summary</Text>
              <Ionicons name="chevron-forward" size={18} color={theme.colors.primary} />
            </View>
          </TouchableOpacity>

          <Text style={styles.subtle}>
            Bets are saved on this phone only. Pending bets settle automatically when the real result is published.
          </Text>

          {!form.isFormOpen ? (
            <TouchableOpacity
              style={styles.logButton}
              onPress={form.openBlankForm}
              accessibilityRole="button"
              accessibilityLabel="Open form to log a new bet"
            >
              <Ionicons name="add" size={20} color={theme.colors.primaryTextOnColor} />
              <Text style={styles.logButtonText}>Log a bet</Text>
            </TouchableOpacity>
          ) : (
            <BetFormModal
              match={form.match}
              onChangeMatch={form.setMatch}
              pick={form.pick}
              onChangePick={form.setPick}
              oddsInput={form.oddsInput}
              onChangeOdds={form.setOddsInput}
              stakeInput={form.stakeInput}
              onChangeStake={form.setStakeInput}
              tag={form.tag}
              onChangeTag={form.setTag}
              currentBankroll={form.currentBankroll}
              maxStakePct={form.maxStakePct}
              validation={form.validation}
              hasSubmittedAttempt={form.hasSubmittedAttempt}
              awaitingMaxStakeConfirm={form.awaitingMaxStakeConfirm}
              onSubmit={form.submitBet}
              onCancel={form.closeForm}
            />
          )}

          <Text style={styles.sectionTitle} accessibilityRole="header">
            Your bets · {bets.length}
            {pendingCount ? <Text style={styles.sectionMeta}>{`  ·  ${pendingCount} waiting for result`}</Text> : null}
          </Text>
        </>
      )}
    </View>
  );

  return (
    <ScreenContainer>
      <AppHeader />
      {activeTab === 'comparisons' ? (
        <FlatList
          data={comparisons}
          keyExtractor={compKeyExtractor}
          renderItem={renderComparisonItem}
          ListHeaderComponent={listHeader}
          ListEmptyComponent={
            <EmptyState
              title="No finished matches yet"
              message="Real scores appear here once predicted matches have been played and the evening update has run."
            />
          }
          ListFooterComponent={<DisclaimerFooter />}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
        />
      ) : (
        <FlatList
          data={bets}
          keyExtractor={betKeyExtractor}
          renderItem={renderBetItem}
          ListHeaderComponent={listHeader}
          ListEmptyComponent={
            <EmptyState
              title="No bets logged yet"
              message="Tap “Log a bet” above, or log one from any match’s full prediction."
              actionLabel="Log first bet"
              onAction={form.openBlankForm}
            />
          }
          ListFooterComponent={<DisclaimerFooter />}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
        />
      )}
    </ScreenContainer>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    headerBlock: { gap: theme.spacing.lg, marginBottom: theme.spacing.md },
    titleBlock: { gap: 4 },
    title: { color: theme.colors.textPrimary, fontSize: 26, fontWeight: '900' },
    subtitle: { color: theme.colors.textSecondary, fontSize: 14, lineHeight: 20 },
    summaryCard: {
      gap: theme.spacing.md,
      padding: theme.spacing.lg,
      borderRadius: 18,
      backgroundColor: theme.colors.surfaceHero,
      borderWidth: theme.layout.borderWidth,
      borderColor: theme.colors.borderAccent,
    },
    summaryGrid: { flexDirection: 'row', gap: theme.spacing.sm },
    summaryCell: { flex: 1, gap: 2 },
    summaryLabel: { color: theme.colors.textSecondary, fontSize: 12 },
    summaryValue: { color: theme.colors.textPrimary, fontSize: 22, fontWeight: '900' },
    summaryValueLime: { color: theme.colors.primary, fontSize: 22, fontWeight: '900' },
    summaryOf: { color: theme.colors.textSecondary, fontSize: 13, fontWeight: theme.typography.weights.regular },
    summaryNote: { color: theme.colors.textSecondary, fontSize: 13, lineHeight: 19 },
    summaryLink: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingTop: 10,
      borderTopWidth: theme.layout.borderWidth,
      borderTopColor: theme.colors.border,
    },
    summaryLinkText: { color: theme.colors.primary, fontSize: 14, fontWeight: theme.typography.weights.bold },
    positive: { color: theme.colors.formWin },
    negative: { color: theme.colors.dangerText },
    subtle: { color: theme.colors.textSecondary, fontSize: 13, lineHeight: 19 },
    logButton: {
      flexDirection: 'row',
      gap: theme.spacing.sm,
      minHeight: 52,
      borderRadius: 26,
      backgroundColor: theme.colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    logButtonText: { color: theme.colors.primaryTextOnColor, fontSize: 16, fontWeight: theme.typography.weights.bold },
    sectionTitle: { color: theme.colors.textPrimary, fontSize: 18, fontWeight: theme.typography.weights.bold },
    sectionMeta: { color: theme.colors.textMuted, fontSize: 13, fontWeight: theme.typography.weights.regular },
    listContent: { paddingBottom: theme.spacing.xxl },
  });
}
