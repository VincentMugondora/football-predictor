import React, { useCallback, useMemo, useState } from 'react';
import { FlatList, ListRenderItemInfo, StyleSheet, Text, View } from 'react-native';

import { AppHeader } from '@/components/AppHeader';
import { AppInput } from '@/components/AppInput';
import { DisclaimerFooter } from '@/components/DisclaimerFooter';
import { EmptyState } from '@/components/EmptyState';
import { InfoBanner } from '@/components/InfoBanner';
import { ScreenContainer } from '@/components/ScreenContainer';
import { SegmentedControl } from '@/components/SegmentedControl';
import { MatchPick } from '@/data/types';
import { PredictionMatchCard } from '@/features/picks/components/PredictionMatchCard';
import { usePicksScreen } from '@/features/picks/hooks/usePicksScreen';
import { pickChance } from '@/lib/winnerLabels';
import { AppTheme, useAppTheme } from '@/theme/useAppTheme';

type SortMode = 'confident' | 'kickoff';

const SORT_OPTIONS = [
  { value: 'confident' as const, label: 'Most confident', accessibilityLabel: 'Sort by most confident first' },
  { value: 'kickoff' as const, label: 'Kick-off time', accessibilityLabel: 'Sort by kick-off time' },
];

export function PredictionsScreen() {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [sortMode, setSortMode] = useState<SortMode>('confident');
  const {
    payload,
    searchQuery,
    setSearchQuery,
    isSearchVisible,
    handleToggleSearch,
    updatedLabel,
    handlePressMatch,
  } = usePicksScreen();

  const matches = useMemo((): MatchPick[] => {
    if (!payload) {
      return [];
    }
    const q = searchQuery.trim().toLowerCase();
    const found = q
      ? payload.matches.filter((m) => `${m.home} ${m.away} ${m.league}`.toLowerCase().includes(q))
      : [...payload.matches];
    return sortMode === 'confident'
      ? found.sort((a, b) => pickChance(b) - pickChance(a))
      : found.sort((a, b) => a.date.localeCompare(b.date));
  }, [payload, searchQuery, sortMode]);

  const keyExtractor = useCallback((item: MatchPick) => item.id, []);
  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<MatchPick>) => (
      <PredictionMatchCard
        match={item}
        updatedFallbackLabel={updatedLabel}
        onPressMatch={handlePressMatch}
      />
    ),
    [updatedLabel, handlePressMatch]
  );

  const listHeader = useMemo(() => {
    const verdictText = payload?.backtest.verdict ?? 'No proven edge: treat these as estimates.';
    return (
      <View style={styles.headerContainer}>
        <View style={styles.titleBlock}>
          <Text style={styles.title} accessibilityRole="header">
            Predictions
          </Text>
          <Text style={styles.subtitle}>
            Our chances next to the bookmakers’ odds, so you can see where we disagree.
          </Text>
        </View>
        <InfoBanner
          tone="warning"
          title={verdictText}
          subtitle="When we disagree with the bookmakers, they have usually been right. Treat a bigger chance as a talking point, not a reason to bet."
        />
        {isSearchVisible ? (
          <AppInput
            label="Search predictions"
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="e.g. Arsenal, Chelsea, Barcelona..."
          />
        ) : null}
        <SegmentedControl
          options={SORT_OPTIONS}
          value={sortMode}
          onChange={setSortMode}
          accessibilityLabel="Sort predictions"
        />
      </View>
    );
  }, [payload, styles, isSearchVisible, searchQuery, setSearchQuery, sortMode]);

  return (
    <ScreenContainer>
      <AppHeader onSearchPress={handleToggleSearch} isSearchActive={isSearchVisible} />
      <FlatList
        data={matches}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={
          <EmptyState
            title="No predictions found"
            message="No matches match your search."
            actionLabel="Clear search"
            onAction={() => setSearchQuery('')}
          />
        }
        ListFooterComponent={
          <View>
            <Text style={styles.legend}>
              Big number = our chance. Small print = bookmaker odds and the chance they imply.
            </Text>
            <DisclaimerFooter />
          </View>
        }
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
      />
    </ScreenContainer>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    headerContainer: {
      gap: theme.spacing.lg,
      marginBottom: theme.spacing.lg,
    },
    titleBlock: { gap: 4 },
    title: { color: theme.colors.textPrimary, fontSize: 26, fontWeight: '900' },
    subtitle: { color: theme.colors.textSecondary, fontSize: 14, lineHeight: 20 },
    legend: { color: theme.colors.textMuted, fontSize: 12, lineHeight: 18, textAlign: 'center' },
    listContent: { paddingBottom: theme.spacing.xxl },
  });
}
