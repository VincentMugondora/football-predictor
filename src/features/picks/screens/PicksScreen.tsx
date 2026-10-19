import React, { useCallback, useMemo } from 'react';
import {
  ActivityIndicator,
  FlatList,
  ListRenderItemInfo,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { AppHeader } from '@/components/AppHeader';
import { AppInput } from '@/components/AppInput';
import { DisclaimerFooter } from '@/components/DisclaimerFooter';
import { EmptyState } from '@/components/EmptyState';
import { FilterChipsRow } from '@/components/FilterChipsRow';
import { InfoBanner } from '@/components/InfoBanner';
import { PillBadge } from '@/components/PillBadge';
import { ScreenContainer } from '@/components/ScreenContainer';
import { FeaturedMatchCard } from '@/features/picks/components/FeaturedMatchCard';
import { MatchPickCard } from '@/features/picks/components/MatchPickCard';
import {
  LEAGUE_FILTERS,
  MatchListItem,
  usePicksScreen,
} from '@/features/picks/hooks/usePicksScreen';
import { AppTheme, useAppTheme } from '@/theme/useAppTheme';

export function PicksScreen() {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const {
    payload,
    isLoading,
    errorMessage,
    selectedLeague,
    setSelectedLeague,
    searchQuery,
    setSearchQuery,
    isSearchVisible,
    handleToggleSearch,
    featuredMatch,
    listItems,
    updatedLabel,
    staleWarning,
    edgeThreshold,
    favouriteMatchIds,
    toggleFavouriteMatch,
    handlePressMatch,
    handleLogOutcome,
    reload,
  } = usePicksScreen();

  const keyExtractor = useCallback((item: MatchListItem) => item.id, []);

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<MatchListItem>) => (
      <View>
        {item.dayHeader ? (
          <View style={styles.dayHeaderPill}>
            <Text style={styles.dayHeaderText} accessibilityRole="header">
              {item.dayHeader}
            </Text>
          </View>
        ) : null}
        <MatchPickCard
          match={item.match}
          edgeThreshold={edgeThreshold}
          isFavourite={favouriteMatchIds.includes(item.match.id)}
          onToggleFavourite={toggleFavouriteMatch}
          onPressMatch={handlePressMatch}
          onLogOutcome={handleLogOutcome}
        />
      </View>
    ),
    [
      styles.dayHeaderPill,
      styles.dayHeaderText,
      edgeThreshold,
      favouriteMatchIds,
      toggleFavouriteMatch,
      handlePressMatch,
      handleLogOutcome,
    ]
  );

  const listHeader = useMemo(() => {
    if (!payload) {
      return undefined;
    }

    const backtestSubtitle = `Log-loss: Model ${payload.backtest.log_loss_model.toFixed(3)} vs Bookmaker ${payload.backtest.log_loss_book.toFixed(3)} • Edge threshold ≥ ${(edgeThreshold * 100).toFixed(1)}%`;

    return (
      <View style={styles.headerBlock}>
        {isSearchVisible ? (
          <AppInput
            label="Search club or league"
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="e.g. Arsenal, La Liga..."
          />
        ) : null}

        <FilterChipsRow
          options={LEAGUE_FILTERS}
          selected={selectedLeague}
          onSelect={setSelectedLeague}
        />

        {featuredMatch && selectedLeague === 'All' && searchQuery.trim().length === 0 ? (
          <FeaturedMatchCard
            match={featuredMatch}
            edgeThreshold={edgeThreshold}
            onPressMatch={handlePressMatch}
            onLogOutcome={handleLogOutcome}
          />
        ) : null}

        <InfoBanner
          title={payload.backtest.verdict}
          subtitle={backtestSubtitle}
          tone="info"
        />

        <View style={styles.freshnessRow}>
          <Text style={styles.updatedText}>{updatedLabel}</Text>
          {staleWarning ? (
            <PillBadge label="STALE (>3 DAYS OLD)" variant="warning" />
          ) : (
            <PillBadge label="OFFLINE READY" variant="positive" />
          )}
        </View>

        {staleWarning ? (
          <InfoBanner
            title="Predictions are over 3 days old"
            subtitle="Odds and team news may have shifted significantly since this snapshot."
            tone="warning"
          />
        ) : null}
      </View>
    );
  }, [
    payload,
    edgeThreshold,
    styles.headerBlock,
    styles.freshnessRow,
    styles.updatedText,
    isSearchVisible,
    searchQuery,
    setSearchQuery,
    selectedLeague,
    setSelectedLeague,
    updatedLabel,
    staleWarning,
    featuredMatch,
    handlePressMatch,
    handleLogOutcome,
  ]);

  if (isLoading) {
    return (
      <ScreenContainer>
        <AppHeader />
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.loadingText}>Loading offline predictions…</Text>
        </View>
      </ScreenContainer>
    );
  }

  if (errorMessage) {
    return (
      <ScreenContainer>
        <AppHeader />
        <EmptyState
          title="Could not load picks"
          message={errorMessage}
          actionLabel="Retry"
          onAction={() => void reload()}
        />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <AppHeader onSearchPress={handleToggleSearch} isSearchActive={isSearchVisible} />
      <FlatList
        data={listItems}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={
          <EmptyState
            title="No matches found"
            message={
              selectedLeague === '★ Favourites'
                ? 'Tap the star icon on any fixture to save it to your favourites.'
                : 'No fixtures match your current filter or search.'
            }
            actionLabel="Show All Matches"
            onAction={() => {
              setSelectedLeague('All');
              setSearchQuery('');
            }}
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
      gap: theme.spacing.sm,
      marginBottom: theme.spacing.xs,
    },
    freshnessRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: theme.spacing.xxs,
    },
    updatedText: {
      color: theme.colors.textSecondary,
      fontSize: theme.typography.sizes.caption,
      fontWeight: theme.typography.weights.medium,
    },
    dayHeaderPill: {
      backgroundColor: theme.colors.surfaceDayPill,
      borderRadius: theme.radii.sm,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      marginTop: theme.spacing.sm,
      marginBottom: theme.spacing.sm,
      borderWidth: theme.layout.borderWidth,
      borderColor: theme.colors.border,
    },
    dayHeaderText: {
      color: theme.colors.textSecondary,
      fontSize: theme.typography.sizes.caption,
      fontWeight: theme.typography.weights.bold,
      letterSpacing: 1.4,
    },
    listContent: {
      paddingBottom: theme.spacing.xxl,
    },
    centerState: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: theme.spacing.md,
    },
    loadingText: {
      color: theme.colors.textSecondary,
      fontSize: theme.typography.sizes.body,
    },
  });
}
