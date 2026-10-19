import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { AppHeader } from '@/components/AppHeader';
import { AppInput } from '@/components/AppInput';
import { DisclaimerFooter } from '@/components/DisclaimerFooter';
import { ScreenContainer } from '@/components/ScreenContainer';
import { TeamCrest } from '@/components/TeamCrest';
import { useAppStore } from '@/data/store';
import { AppTheme, useAppTheme } from '@/theme/useAppTheme';

const ALL_CLUB_TEAMS = [
  'Arsenal',
  'Barcelona',
  'Inter',
  'Liverpool',
  'Chelsea',
  'Bayern Munich',
  'Roma',
  'Tottenham',
  'Everton',
  'Aston Villa',
  'Sevilla',
  'Dortmund',
] as const;

export function FavouritesScreen() {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchVisible, setIsSearchVisible] = useState(false);

  const favouriteTeams = useAppStore((s) => s.favouriteTeams);
  const toggleFavouriteTeam = useAppStore((s) => s.toggleFavouriteTeam);

  const query = searchQuery.trim().toLowerCase();

  const { favList, addList } = useMemo(() => {
    const filtered = ALL_CLUB_TEAMS.filter((team) =>
      query.length === 0 ? true : team.toLowerCase().includes(query)
    );
    return {
      favList: filtered.filter((team) => favouriteTeams.includes(team)),
      addList: filtered.filter((team) => !favouriteTeams.includes(team)),
    };
  }, [favouriteTeams, query]);

  const handleToggleSearch = () => {
    setIsSearchVisible((prev) => {
      if (prev) {
        setSearchQuery('');
      }
      return !prev;
    });
  };

  return (
    <ScreenContainer>
      <AppHeader onSearchPress={handleToggleSearch} isSearchActive={isSearchVisible} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {isSearchVisible ? (
          <AppInput
            label="Search teams"
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="e.g. Arsenal, Liverpool, Bayern..."
          />
        ) : null}

        <Text style={styles.sectionHeader} accessibilityRole="header">
          YOUR FAVOURITE TEAMS
        </Text>

        {favList.map((team) => (
          <View key={team} style={[styles.teamCard, theme.shadows.card]}>
            <View style={styles.teamLeft}>
              <TeamCrest teamName={team} size="md" />
              <Text style={styles.teamName} numberOfLines={1}>
                {team}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.starBtn}
              onPress={() => toggleFavouriteTeam(team)}
              accessibilityRole="button"
              accessibilityState={{ selected: true }}
              accessibilityLabel={`Remove ${team} from favourite teams`}
            >
              <Ionicons name="star" size={26} color={theme.colors.primary} />
            </TouchableOpacity>
          </View>
        ))}

        <View style={styles.addTeamsPill}>
          <Text style={styles.addTeamsText} accessibilityRole="header">
            ADD TEAMS
          </Text>
        </View>

        {addList.map((team) => (
          <View key={team} style={[styles.teamCard, theme.shadows.card]}>
            <View style={styles.teamLeft}>
              <TeamCrest teamName={team} size="md" />
              <Text style={styles.teamName} numberOfLines={1}>
                {team}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.starBtn}
              onPress={() => toggleFavouriteTeam(team)}
              accessibilityRole="button"
              accessibilityState={{ selected: false }}
              accessibilityLabel={`Add ${team} to favourite teams`}
            >
              <Ionicons
                name="star-outline"
                size={26}
                color={theme.colors.textSecondary}
              />
            </TouchableOpacity>
          </View>
        ))}

        <DisclaimerFooter />
      </ScrollView>
    </ScreenContainer>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    scrollContent: {
      gap: theme.spacing.sm,
      paddingBottom: theme.spacing.xxl,
    },
    sectionHeader: {
      color: theme.colors.textSecondary,
      fontSize: theme.typography.sizes.caption,
      fontWeight: theme.typography.weights.bold,
      letterSpacing: 1.5,
      marginTop: theme.spacing.sm,
      marginBottom: theme.spacing.xs,
      paddingHorizontal: theme.spacing.xs,
    },
    addTeamsPill: {
      backgroundColor: theme.colors.surfaceDayPill,
      borderRadius: theme.radii.sm,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      marginTop: theme.spacing.md,
      marginBottom: theme.spacing.xs,
      borderWidth: theme.layout.borderWidth,
      borderColor: theme.colors.border,
    },
    addTeamsText: {
      color: theme.colors.textSecondary,
      fontSize: theme.typography.sizes.caption,
      fontWeight: theme.typography.weights.bold,
      letterSpacing: 1.5,
    },
    teamCard: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: theme.colors.surface,
      borderColor: theme.colors.border,
      borderWidth: theme.layout.borderWidth,
      borderRadius: theme.radii.card,
      paddingHorizontal: theme.spacing.lg,
      paddingVertical: theme.spacing.md,
    },
    teamLeft: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.lg,
    },
    teamName: {
      flexShrink: 1,
      color: theme.colors.textPrimary,
      fontSize: theme.typography.sizes.statValue,
      lineHeight: theme.typography.lineHeights.statValue,
      fontWeight: theme.typography.weights.medium,
    },
    starBtn: {
      minWidth: theme.layout.minTouchTarget,
      minHeight: theme.layout.minTouchTarget,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
}
