import React, { useCallback, useMemo } from 'react';
import { FlatList, ListRenderItemInfo, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '@/components/AppButton';
import { AppHeader } from '@/components/AppHeader';
import { DisclaimerFooter } from '@/components/DisclaimerFooter';
import { EmptyState } from '@/components/EmptyState';
import { InfoBanner } from '@/components/InfoBanner';
import { ScreenContainer } from '@/components/ScreenContainer';
import { useAppStore } from '@/data/store';
import { BetRecord } from '@/data/types';
import { BetFormModal } from '@/features/betLog/components/BetFormModal';
import { BetRowCard } from '@/features/betLog/components/BetRowCard';
import { useBetForm } from '@/features/betLog/hooks/useBetForm';
import { AppTheme, useAppTheme } from '@/theme/useAppTheme';

export function BetLogScreen() {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const bets = useAppStore((s) => s.bets);
  const updateBetResult = useAppStore((s) => s.updateBetResult);
  const deleteBet = useAppStore((s) => s.deleteBet);

  const form = useBetForm();

  const keyExtractor = useCallback((item: BetRecord) => item.id, []);

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<BetRecord>) => (
      <BetRowCard
        bet={item}
        onChangeResult={updateBetResult}
        onDelete={deleteBet}
      />
    ),
    [updateBetResult, deleteBet]
  );

  const listHeader = useMemo(
    () => (
      <View style={styles.headerBlock}>
        <InfoBanner
          title="Illustrative sample results — not verified performance"
          subtitle="All bets are stored locally on your device. Never connect a bookmaker."
          tone="info"
        />

        <View style={styles.sectionTitleRow}>
          <Text style={styles.sectionTitle} accessibilityRole="header">
            Recent results ({bets.length})
          </Text>
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
      </View>
    ),
    [styles.headerBlock, styles.sectionTitleRow, styles.sectionTitle, bets.length, form]
  );

  return (
    <ScreenContainer>
      <AppHeader />
      <FlatList
        data={bets}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={
          <EmptyState
            title="No bets logged yet"
            message="Tap '+ Add Bet' above or '+ Log' on any match in the Picks tab to track your bets offline."
            actionLabel="Log First Bet"
            onAction={form.openBlankForm}
          />
        }
        ListFooterComponent={<DisclaimerFooter />}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
      />
    </ScreenContainer>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    headerBlock: {
      gap: theme.spacing.md,
      marginBottom: theme.spacing.sm,
    },
    sectionTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: theme.spacing.xs,
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
