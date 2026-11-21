import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { AppHeader } from '@/components/AppHeader';
import { AppInput } from '@/components/AppInput';
import { ConfidenceTag } from '@/components/ConfidenceTag';
import { DisclaimerFooter } from '@/components/DisclaimerFooter';
import { ScreenContainer } from '@/components/ScreenContainer';
import { TeamCrest } from '@/components/TeamCrest';
import { useAppStore } from '@/data/store';
import { MatchPick } from '@/data/types';
import { usePicksScreen } from '@/features/picks/hooks/usePicksScreen';
import { formatDayTitle, formatLocalTime } from '@/lib/dateUtils';
import { confidenceLevel, formatLikelyScore, summariseWinner } from '@/lib/winnerLabels';
import { AppTheme, useAppTheme } from '@/theme/useAppTheme';

const POPULAR_TEAMS = [
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

function nextMatchFor(team: string, matches: MatchPick[]): MatchPick | null {
  return (
    matches
      .filter((m) => m.home === team || m.away === team)
      .sort((a, b) => a.date.localeCompare(b.date))[0] ?? null
  );
}

export function FavouritesScreen() {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchVisible, setIsSearchVisible] = useState(false);
  const favouriteTeams = useAppStore((s) => s.favouriteTeams);
  const toggleFavouriteTeam = useAppStore((s) => s.toggleFavouriteTeam);
  const { payload, handlePressMatch } = usePicksScreen();
  const matches = useMemo(() => payload?.matches ?? [], [payload]);

  const query = searchQuery.trim().toLowerCase();
  const { favList, addList, leagueOf } = useMemo(() => {
    const leagues = new Map<string, string>();
    for (const m of matches) {
      leagues.set(m.home, m.league);
      leagues.set(m.away, m.league);
    }
    const allTeams = Array.from(new Set<string>([...favouriteTeams, ...POPULAR_TEAMS, ...leagues.keys()]));
    const filtered = allTeams.filter((team) => (query ? team.toLowerCase().includes(query) : true));
    return {
      favList: filtered.filter((team) => favouriteTeams.includes(team)),
      addList: filtered.filter((team) => !favouriteTeams.includes(team)).sort((a, b) => a.localeCompare(b)),
      leagueOf: leagues,
    };
  }, [favouriteTeams, matches, query]);

  const handleToggleSearch = () => {
    setIsSearchVisible((prev) => {
      if (prev) setSearchQuery('');
      return !prev;
    });
  };

  return (
    <ScreenContainer>
      <AppHeader onSearchPress={handleToggleSearch} isSearchActive={isSearchVisible} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={styles.titleBlock}>
          <Text style={styles.title} accessibilityRole="header">
            Favourites
          </Text>
          <Text style={styles.subtitle}>Follow your teams to see their next prediction first.</Text>
        </View>

        {isSearchVisible ? (
          <AppInput
            label="Search teams"
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="e.g. Arsenal, Liverpool, Bayern..."
          />
        ) : null}

        <Text style={styles.sectionHeader} accessibilityRole="header">
          Your teams · {favList.length}
        </Text>
        {favList.length === 0 ? (
          <Text style={styles.empty}>Tap the star next to a team below to follow it.</Text>
        ) : null}
        {favList.map((team) => {
          const next = nextMatchFor(team, matches);
          const summary = next ? summariseWinner(next) : null;
          const score = next ? formatLikelyScore(next) : null;
          const opponent = next ? (next.home === team ? next.away : next.home) : null;
          return (
            <View key={team} style={styles.teamCard}>
              <View style={styles.teamRow}>
                <TeamCrest teamName={team} size="md" />
                <View style={styles.teamText}>
                  <Text style={styles.teamName} numberOfLines={1}>
                    {team}
                  </Text>
                  <Text style={styles.teamMeta} numberOfLines={1}>
                    {next
                      ? `${formatDayTitle(next.date)} ${formatLocalTime(next.date)} ${
                          next.home === team ? 'vs' : 'at'
                        } ${opponent}`
                      : 'No match in the next 7 days'}
                  </Text>
                </View>
                <TouchableOpacity
                  style={[styles.starBtn, styles.starBtnOn]}
                  onPress={() => toggleFavouriteTeam(team)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: true }}
                  accessibilityLabel={`Remove ${team} from favourite teams`}
                >
                  <Ionicons name="star" size={22} color={theme.colors.primary} />
                </TouchableOpacity>
              </View>
              {next && summary ? (
                <TouchableOpacity
                  style={styles.nextBox}
                  onPress={() => handlePressMatch(next.id)}
                  accessibilityRole="button"
                  accessibilityLabel={`Next prediction for ${team}: ${summary.headline}${score ? `, ${score}` : ''}. Opens full prediction`}
                >
                  <View style={styles.nextText}>
                    <Text style={styles.nextLabel}>Next prediction</Text>
                    <Text style={styles.nextPick} numberOfLines={1}>
                      {summary.headline}
                      {score ? <Text style={styles.nextScore}>{`  ${score}`}</Text> : null}
                    </Text>
                  </View>
                  <ConfidenceTag level={confidenceLevel(next)} />
                </TouchableOpacity>
              ) : null}
            </View>
          );
        })}

        <Text style={[styles.sectionHeader, styles.sectionGap]} accessibilityRole="header">
          Add teams
        </Text>
        <View style={styles.addList}>
          {addList.map((team, index) => (
            <View key={team} style={[styles.addRow, index === addList.length - 1 ? styles.addRowLast : null]}>
              <TeamCrest teamName={team} size="sm" />
              <View style={styles.teamText}>
                <Text style={styles.addName} numberOfLines={1}>
                  {team}
                </Text>
                {leagueOf.get(team) ? <Text style={styles.addLeague}>{leagueOf.get(team)}</Text> : null}
              </View>
              <TouchableOpacity
                style={styles.starBtn}
                onPress={() => toggleFavouriteTeam(team)}
                accessibilityRole="button"
                accessibilityState={{ selected: false }}
                accessibilityLabel={`Add ${team} to favourite teams`}
              >
                <Ionicons name="star-outline" size={22} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            </View>
          ))}
        </View>
        <DisclaimerFooter />
      </ScrollView>
    </ScreenContainer>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    scrollContent: { gap: theme.spacing.md, paddingBottom: theme.spacing.xxl },
    titleBlock: { gap: 4, marginBottom: theme.spacing.xs },
    title: { color: theme.colors.textPrimary, fontSize: 26, fontWeight: '900' },
    subtitle: { color: theme.colors.textSecondary, fontSize: 14, lineHeight: 20 },
    sectionHeader: { color: theme.colors.textPrimary, fontSize: 18, fontWeight: theme.typography.weights.bold },
    sectionGap: { marginTop: theme.spacing.sm },
    empty: { color: theme.colors.textSecondary, fontSize: 14 },
    teamCard: {
      gap: theme.spacing.md,
      padding: theme.spacing.lg,
      borderRadius: 18,
      backgroundColor: theme.colors.surface,
      borderWidth: theme.layout.borderWidth,
      borderColor: theme.colors.border,
    },
    teamRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md },
    teamText: { flex: 1, gap: 2 },
    teamName: { color: theme.colors.textPrimary, fontSize: 17, fontWeight: theme.typography.weights.bold },
    teamMeta: { color: theme.colors.textSecondary, fontSize: 13 },
    starBtn: {
      width: theme.layout.minTouchTarget,
      height: theme.layout.minTouchTarget,
      borderRadius: theme.radii.pill,
      alignItems: 'center',
      justifyContent: 'center',
    },
    starBtnOn: { backgroundColor: theme.colors.primaryMuted },
    nextBox: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: theme.spacing.sm,
      padding: theme.spacing.md,
      borderRadius: 12,
      backgroundColor: theme.colors.surfaceElevated,
    },
    nextText: { flex: 1, gap: 2 },
    nextLabel: { color: theme.colors.textSecondary, fontSize: 12 },
    nextPick: { color: theme.colors.textPrimary, fontSize: 16, fontWeight: theme.typography.weights.bold },
    nextScore: { color: theme.colors.primary },
    addList: {
      borderRadius: 18,
      backgroundColor: theme.colors.surface,
      borderWidth: theme.layout.borderWidth,
      borderColor: theme.colors.border,
      overflow: 'hidden',
    },
    addRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      paddingLeft: theme.spacing.lg,
      paddingRight: theme.spacing.md,
      borderBottomWidth: theme.layout.borderWidth,
      borderBottomColor: theme.colors.border,
    },
    addRowLast: { borderBottomWidth: 0 },
    addName: { color: theme.colors.textPrimary, fontSize: 16, fontWeight: theme.typography.weights.medium },
    addLeague: { color: theme.colors.textMuted, fontSize: 12 },
  });
}
