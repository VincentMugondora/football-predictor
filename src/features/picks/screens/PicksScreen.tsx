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
import { ScreenContainer } from '@/components/ScreenContainer';
import { SegmentedControl } from '@/components/SegmentedControl';
import { FeaturedMatchCard } from '@/features/picks/components/FeaturedMatchCard';
import { MatchPickCard } from '@/features/picks/components/MatchPickCard';
import { MatchListItem, usePicksScreen } from '@/features/picks/hooks/usePicksScreen';
import { DAY_FILTER_LABELS, DayFilter } from '@/lib/dateUtils';
import { AppTheme, useAppTheme } from '@/theme/useAppTheme';

const DAY_OPTIONS = (Object.keys(DAY_FILTER_LABELS) as DayFilter[]).map((value) => ({
  value,
  label: DAY_FILTER_LABELS[value],
  accessibilityLabel: `Show matches ${DAY_FILTER_LABELS[value].toLowerCase()}`,
}));

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
    dayFilter,
    setDayFilter,
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
    leagueFilters,
  } = usePicksScreen();

  const keyExtractor = useCallback((item: MatchListItem) => item.id, []);

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<MatchListItem>) => (
      <View>
        {item.dayHeader ? (
          <Text style={styles.dayHeader} accessibilityRole="header">
            {item.dayHeader}
          </Text>
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
      styles.dayHeader,
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
    return (
      <View style={styles.headerBlock}>
        <View style={styles.freshnessRow}>
          <View style={[styles.freshDot, staleWarning ? styles.staleDot : null]} />
          <Text style={styles.freshText}>
            {updatedLabel} · {staleWarning ? 'Over 3 days old' : 'Works offline'}
          </Text>
        </View>
        {staleWarning ? (
          <InfoBanner
            title="Predictions are over 3 days old"
            subtitle="Team news and odds may have changed since these were made."
            tone="warning"
          />
        ) : null}
        <SegmentedControl
          options={DAY_OPTIONS}
          value={dayFilter}
          onChange={setDayFilter}
          accessibilityLabel="Choose which day to show"
        />
        {isSearchVisible ? (
          <AppInput
            label="Search club or league"
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="e.g. Arsenal, La Liga..."
          />
        ) : null}
        <FilterChipsRow
          options={leagueFilters}
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
      </View>
    );
  }, [
    payload,
    styles,
    staleWarning,
    updatedLabel,
    dayFilter,
    setDayFilter,
    edgeThreshold,
    isSearchVisible,
    searchQuery,
    setSearchQuery,
    selectedLeague,
    setSelectedLeague,
    featuredMatch,
    handlePressMatch,
    handleLogOutcome,
  ]);

  const listFooter = useMemo(() => {
    if (!payload) {
      return <DisclaimerFooter />;
    }
    const tested = payload.backtest.test_matches;
    const marketLoss = payload.backtest.log_loss_book;
    const subtitle =
      marketLoss === null
        ? 'No bookmaker odds were available to compare against. Use these as a guide, not a sure thing.'
        : `${tested ? `Tested on ${tested.toLocaleString()} past matches. ` : ''}${
            payload.backtest.log_loss_model > marketLoss
              ? 'The model was slightly less accurate than bookmaker odds.'
              : 'The model was about as accurate as bookmaker odds.'
          } Use it as a guide, not a sure thing.`;
    return (
      <View style={styles.footerBlock}>
        <InfoBanner title={payload.backtest.verdict} subtitle={subtitle} tone="info" />
        <DisclaimerFooter />
      </View>
    );
  }, [payload, styles.footerBlock]);

  if (isLoading) {
    return (
      <ScreenContainer>
        <AppHeader />
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.loadingText}>Loading predictions…</Text>
        </View>
      </ScreenContainer>
    );
  }

  if (errorMessage) {
    return (
      <ScreenContainer>
        <AppHeader />
        <EmptyState
          title="Could not load predictions"
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
          featuredMatch && selectedLeague === 'All' && !searchQuery.trim() ? undefined : (
            <EmptyState
              title={
                payload?.data_status === 'no_fixtures' ? 'No upcoming fixtures' : 'No matches found'
              }
              message={
                payload?.data_status === 'no_fixtures'
                  ? 'No verified fixtures are available in the next seven days. Check again when the data updates.'
                  : 'No matches for this day, league or search. Try "This week".'
              }
              actionLabel={payload?.data_status === 'no_fixtures' ? 'Refresh' : 'Show this week'}
              onAction={() => {
                if (payload?.data_status === 'no_fixtures') void reload();
                else {
                  setDayFilter('week');
                  setSelectedLeague('All');
                  setSearchQuery('');
                }
              }}
            />
          )
        }
        ListFooterComponent={listFooter}
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
    freshnessRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
    },
    freshDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: theme.colors.formWin,
    },
    staleDot: {
      backgroundColor: theme.colors.warningText,
    },
    freshText: {
      color: theme.colors.textSecondary,
      fontSize: 13,
    },
    dayHeader: {
      color: theme.colors.textPrimary,
      fontSize: 18,
      fontWeight: theme.typography.weights.bold,
      marginTop: theme.spacing.md,
      marginBottom: theme.spacing.md,
    },
    footerBlock: {
      marginTop: theme.spacing.md,
      gap: theme.spacing.sm,
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
