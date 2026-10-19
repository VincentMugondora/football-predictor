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

import { AppButton } from '@/components/AppButton';
import { AppHeader } from '@/components/AppHeader';
import { DisclaimerFooter } from '@/components/DisclaimerFooter';
import { EmptyState } from '@/components/EmptyState';
import { InfoBanner } from '@/components/InfoBanner';
import { ScreenContainer } from '@/components/ScreenContainer';
import { useAppStore } from '@/data/store';
import { BetRecord, MatchResultComparison } from '@/data/types';
import { BetFormModal } from '@/features/betLog/components/BetFormModal';
import { BetRowCard } from '@/features/betLog/components/BetRowCard';
import { PredictionComparisonCard } from '@/features/betLog/components/PredictionComparisonCard';
import { useBetForm } from '@/features/betLog/hooks/useBetForm';
import { usePicksScreen } from '@/features/picks/hooks/usePicksScreen';
import { formatPercentage } from '@/lib/calculations';
import { AppTheme, useAppTheme } from '@/theme/useAppTheme';

type ResultsTabMode = 'comparisons' | 'bets';

export function BetLogScreen() {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [tabMode, setTabMode] = useState<ResultsTabMode>('comparisons');

  const { payload } = usePicksScreen();
  const comparisons = useMemo(
    (): MatchResultComparison[] => payload?.recent_comparisons ?? [],
    [payload]
  );

  const bets = useAppStore((s) => s.bets);
  const updateBetResult = useAppStore((s) => s.updateBetResult);
  const reconcileBetsWithResults = useAppStore((s) => s.reconcileBetsWithResults);
  const deleteBet = useAppStore((s) => s.deleteBet);

  const form = useBetForm();
  const activeTab: ResultsTabMode = form.isFormOpen ? 'bets' : tabMode;

  // Automatically settle any Pending bets whose match appears in recent post-match results
  useEffect(() => {
    if (comparisons.length > 0) {
      reconcileBetsWithResults(comparisons);
    }
  }, [comparisons, reconcileBetsWithResults]);

  const hitCount = useMemo(
    () => comparisons.filter((c) => c.correct).length,
    [comparisons]
  );
  const modelHitRate =
    payload?.backtest.recent_hit_rate_model ??
    (comparisons.length > 0 ? hitCount / comparisons.length : 0);
  const bookHitRate = payload?.backtest.recent_hit_rate_book ?? 0;

  const betKeyExtractor = useCallback((item: BetRecord) => item.id, []);
  const compKeyExtractor = useCallback((item: MatchResultComparison) => item.id, []);

  const renderBetItem = useCallback(
    ({ item }: ListRenderItemInfo<BetRecord>) => (
      <BetRowCard bet={item} onChangeResult={updateBetResult} onDelete={deleteBet} />
    ),
    [updateBetResult, deleteBet]
  );

  const renderComparisonItem = useCallback(
    ({ item }: ListRenderItemInfo<MatchResultComparison>) => (
      <PredictionComparisonCard item={item} />
    ),
    []
  );

  const listHeader = useMemo(
    () => (
      <View style={styles.headerBlock}>
        {/* Mode Switcher: Predicted vs Actual | My Logged Bets */}
        <View style={styles.segmentedRow}>
          <TouchableOpacity
            style={[
              styles.segmentButton,
              activeTab === 'comparisons'
                ? styles.segmentButtonActive
                : styles.segmentButtonInactive,
            ]}
            onPress={() => {
              if (form.isFormOpen) {
                form.closeForm();
              }
              setTabMode('comparisons');
            }}
            accessibilityRole="tab"
            accessibilityState={{ selected: activeTab === 'comparisons' }}
            accessibilityLabel="Show pre-match model predictions compared with actual results"
          >
            <Text
              style={[
                styles.segmentButtonText,
                activeTab === 'comparisons'
                  ? styles.segmentButtonTextActive
                  : styles.segmentButtonTextInactive,
              ]}
            >
              Predicted vs Actual ({comparisons.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.segmentButton,
              activeTab === 'bets'
                ? styles.segmentButtonActive
                : styles.segmentButtonInactive,
            ]}
            onPress={() => setTabMode('bets')}
            accessibilityRole="tab"
            accessibilityState={{ selected: activeTab === 'bets' }}
            accessibilityLabel="Show your logged bets and bankroll tracker"
          >
            <Text
              style={[
                styles.segmentButtonText,
                activeTab === 'bets'
                  ? styles.segmentButtonTextActive
                  : styles.segmentButtonTextInactive,
              ]}
            >
              My Bets ({bets.length})
            </Text>
          </TouchableOpacity>
        </View>

        {activeTab === 'comparisons' ? (
          <>
            <InfoBanner
              title={`Post-Match Verification — ${hitCount}/${comparisons.length} recent hits`}
              subtitle={`Strict pre-match model accuracy: ${formatPercentage(modelHitRate, 1)} (Market favourite: ${formatPercentage(bookHitRate, 1)}). Updated daily after full-time results.`}
              tone="info"
            />
            <View style={styles.sectionTitleRow}>
              <Text style={styles.sectionTitle} accessibilityRole="header">
                Completed match comparisons ({comparisons.length})
              </Text>
              <AppButton
                label="Summary"
                onPress={() => router.push('/summary')}
                variant="secondary"
                compact
                accessibilityLabel="View bankroll summary and model backtest"
              />
            </View>
          </>
        ) : (
          <>
            <InfoBanner
              title="Offline Bet Tracker — Auto-settled from real results"
              subtitle="Pending bets matching completed fixtures are settled automatically. All bets stay on your device."
              tone="info"
            />

            <View style={styles.sectionTitleRow}>
              <Text style={styles.sectionTitle} accessibilityRole="header">
                My logged bets ({bets.length})
              </Text>
              <View style={styles.actionsGroup}>
                <AppButton
                  label="Summary"
                  onPress={() => router.push('/summary')}
                  variant="secondary"
                  compact
                  accessibilityLabel="View bankroll summary and ROI"
                />
                {!form.isFormOpen ? (
                  <AppButton
                    label="+ Add Bet"
                    onPress={form.openBlankForm}
                    variant="primary"
                    compact
                    accessibilityLabel="Open form to log a new bet"
                  />
                ) : null}
              </View>
            </View>

            {form.isFormOpen ? (
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
            ) : null}
          </>
        )}
      </View>
    ),
    [
      styles,
      activeTab,
      comparisons.length,
      bets.length,
      hitCount,
      modelHitRate,
      bookHitRate,
      form,
    ]
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
              title="No completed match comparisons yet"
              message="Run the daily model pipeline after matches finish to compare predicted outcomes with real full-time scores."
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
              message="Tap '+ Add Bet' above or '+ Log' on any match in the Predictions tab to track your bets offline."
              actionLabel="Log First Bet"
              onAction={form.openBlankForm}
            />
          }
          ListFooterComponent={<DisclaimerFooter />}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
        />
      )}
    </ScreenContainer>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    headerBlock: {
      gap: theme.spacing.md,
      marginBottom: theme.spacing.sm,
    },
    segmentedRow: {
      flexDirection: 'row',
      gap: theme.spacing.xs,
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radii.pill,
      padding: theme.spacing.xxs,
      borderWidth: theme.layout.borderWidth,
      borderColor: theme.colors.border,
    },
    segmentButton: {
      flex: 1,
      minHeight: theme.layout.minTouchTarget,
      borderRadius: theme.radii.pill,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: theme.spacing.sm,
    },
    segmentButtonActive: {
      backgroundColor: theme.colors.primary,
    },
    segmentButtonInactive: {
      backgroundColor: 'transparent',
    },
    segmentButtonText: {
      fontSize: theme.typography.sizes.caption,
      fontWeight: theme.typography.weights.bold,
    },
    segmentButtonTextActive: {
      color: theme.colors.primaryTextOnColor,
    },
    segmentButtonTextInactive: {
      color: theme.colors.textSecondary,
    },
    sectionTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: theme.spacing.xs,
    },
    actionsGroup: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.xs,
    },
    sectionTitle: {
      color: theme.colors.textSecondary,
      fontSize: theme.typography.sizes.sectionTitle,
      fontWeight: theme.typography.weights.semibold,
    },
    listContent: {
      paddingBottom: theme.spacing.xxl,
    },
  });
}
