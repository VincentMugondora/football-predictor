import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useMemo } from 'react';
import { FlatList, ListRenderItemInfo, StyleSheet, Text, View } from 'react-native';

import { AppHeader } from '@/components/AppHeader';
import { AppInput } from '@/components/AppInput';
import { DisclaimerFooter } from '@/components/DisclaimerFooter';
import { EmptyState } from '@/components/EmptyState';
import { ScreenContainer } from '@/components/ScreenContainer';
import { MatchPick } from '@/data/types';
import { PredictionMatchCard } from '@/features/picks/components/PredictionMatchCard';
import { usePicksScreen } from '@/features/picks/hooks/usePicksScreen';
import { AppTheme, useAppTheme } from '@/theme/useAppTheme';

export function PredictionsScreen() {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const {
    payload,
    searchQuery,
    setSearchQuery,
    isSearchVisible,
    handleToggleSearch,
    updatedLabel,
    edgeThreshold,
    handlePressMatch,
    handleLogOutcome,
  } = usePicksScreen();

  const matches = useMemo((): MatchPick[] => {
    if (!payload) {
      return [];
    }
    const q = searchQuery.trim().toLowerCase();
    if (!q) {
      return payload.matches;
    }
    return payload.matches.filter((m) =>
      `${m.home} ${m.away} ${m.league}`.toLowerCase().includes(q)
    );
  }, [payload, searchQuery]);

  const keyExtractor = useCallback((item: MatchPick) => item.id, []);

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<MatchPick>) => (
      <PredictionMatchCard
        match={item}
        edgeThreshold={edgeThreshold}
        updatedFallbackLabel={updatedLabel}
        onPressMatch={handlePressMatch}
        onLogOutcome={handleLogOutcome}
      />
    ),
    [edgeThreshold, updatedLabel, handlePressMatch, handleLogOutcome]
  );

  const listHeader = useMemo(() => {
    const verdictText =
      payload?.backtest.verdict ?? 'No proven edge: treat these as estimates.';

    return (
      <View style={styles.headerContainer}>
        {isSearchVisible ? (
          <AppInput
            label="Search predictions"
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="e.g. Arsenal, Chelsea, Barcelona..."
          />
        ) : null}

        <View style={styles.demoGoldBanner} accessible={true} accessibilityRole="alert">
          <View style={styles.demoIconCircle}>
            <Ionicons name="information" size={14} color={theme.colors.demoBannerText} />
          </View>
          <Text style={styles.demoBannerText}>{verdictText}</Text>
        </View>
      </View>
    );
  }, [
    payload,
    styles.headerContainer,
    styles.demoGoldBanner,
    styles.demoIconCircle,
    styles.demoBannerText,
    theme.colors.demoBannerText,
    isSearchVisible,
    searchQuery,
    setSearchQuery,
  ]);

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
            message="No matches match your search query."
            actionLabel="Clear Search"
            onAction={() => setSearchQuery('')}
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
    headerContainer: {
      gap: theme.spacing.md,
      marginTop: theme.spacing.xs,
      marginBottom: theme.spacing.md,
    },
    demoGoldBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.colors.demoBannerBg,
      borderRadius: theme.radii.banner,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.md,
      gap: theme.spacing.sm,
    },
    demoIconCircle: {
      width: 22,
      height: 22,
      borderRadius: theme.radii.pill,
      backgroundColor: theme.colors.demoBannerIconBg,
      alignItems: 'center',
      justifyContent: 'center',
    },
    demoBannerText: {
      flex: 1,
      flexShrink: 1,
      color: theme.colors.demoBannerText,
      fontSize: theme.typography.sizes.body,
      lineHeight: theme.typography.lineHeights.body,
      fontWeight: theme.typography.weights.semibold,
    },
    listContent: {
      paddingBottom: theme.spacing.xxl,
    },
  });
}
