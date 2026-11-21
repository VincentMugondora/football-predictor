import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { PicksLoadError, picksRepository } from '@/data/picksRepository';
import { useAppStore } from '@/data/store';
import { MatchPick, OutcomeKey, PicksPayload } from '@/data/types';
import {
  DayFilter,
  formatDayTitle,
  formatUpdatedRelative,
  isDataStale,
  matchesDayFilter,
} from '@/lib/dateUtils';

export const LEAGUE_FILTERS = [
  'All',
  'Premier League',
  'La Liga',
  'Serie A',
  'Bundesliga',
] as const;

export interface MatchListItem {
  id: string;
  match: MatchPick;
  dayHeader?: string;
}

function getPicksErrorMessage(error: unknown): string {
  if (error instanceof PicksLoadError) return error.message;
  return 'The picks could not be loaded because of an unexpected app error. Try again.';
}

export function usePicksScreen() {
  const [payload, setPayload] = useState<PicksPayload | null>(() =>
    picksRepository.getCachedPicks()
  );
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedLeague, setSelectedLeague] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isSearchVisible, setIsSearchVisible] = useState<boolean>(false);
  // null = not chosen yet: start on the first day that has matches.
  const [chosenDayFilter, setDayFilter] = useState<DayFilter | null>(null);

  const edgeThreshold = useAppStore((s) => s.settings.edgeThreshold);
  const favouriteMatchIds = useAppStore((s) => s.favouriteMatchIds);
  const toggleFavouriteMatch = useAppStore((s) => s.toggleFavouriteMatch);
  const setDraftBet = useAppStore((s) => s.setDraftBet);

  useEffect(() => {
    let isCancelled = false;
    picksRepository
      .getPicks()
      .then((data) => {
        if (!isCancelled) {
          setPayload(data);
          setErrorMessage(null);
          setIsLoading(false);
        }
      })
      .catch((error: unknown) => {
        if (!isCancelled) {
          setErrorMessage(getPicksErrorMessage(error));
          setIsLoading(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, []);

  const reload = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const data = await picksRepository.getPicks();
      setPayload(data);
    } catch (error) {
      setErrorMessage(getPicksErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  }, []);

  const dayFilter = useMemo((): DayFilter => {
    if (chosenDayFilter) return chosenDayFilter;
    const matches = payload?.matches ?? [];
    if (matches.some((m) => matchesDayFilter(m.date, 'today'))) return 'today';
    if (matches.some((m) => matchesDayFilter(m.date, 'tomorrow'))) return 'tomorrow';
    return 'week';
  }, [chosenDayFilter, payload]);

  const dayMatches = useMemo(
    () => (payload?.matches ?? []).filter((m) => matchesDayFilter(m.date, dayFilter)),
    [payload, dayFilter]
  );

  const featuredMatch = useMemo(() => {
    return (
      dayMatches.find((m) => m.featured && !m.low_confidence) ??
      dayMatches.find((m) => !m.low_confidence) ??
      null
    );
  }, [dayMatches]);

  const listItems = useMemo((): MatchListItem[] => {
    if (!payload) {
      return [];
    }
    const query = searchQuery.trim().toLowerCase();

    const filtered = dayMatches.filter((match) => {
      if (
        selectedLeague === 'All' &&
        query.length === 0 &&
        featuredMatch &&
        match.id === featuredMatch.id
      ) {
        return false;
      }

      if (selectedLeague === '★ Favourites') {
        if (!favouriteMatchIds.includes(match.id)) {
          return false;
        }
      } else if (selectedLeague !== 'All' && match.league !== selectedLeague) {
        return false;
      }

      if (query.length > 0) {
        const hay = `${match.home} ${match.away} ${match.league}`.toLowerCase();
        return hay.includes(query);
      }

      return true;
    });

    let lastDayHeader = '';
    return filtered.map((match) => {
      const dayHeader = formatDayTitle(match.date);
      const showHeader = dayHeader !== lastDayHeader;
      lastDayHeader = dayHeader;
      return {
        id: match.id,
        match,
        dayHeader: showHeader ? dayHeader : undefined,
      };
    });
  }, [payload, dayMatches, selectedLeague, searchQuery, favouriteMatchIds, featuredMatch]);

  const updatedLabel = useMemo(() => {
    if (!payload) {
      return '';
    }
    return formatUpdatedRelative(payload.generated_at);
  }, [payload]);

  const staleWarning = useMemo(() => {
    if (!payload) {
      return false;
    }
    return isDataStale(payload.generated_at);
  }, [payload]);

  const handlePressMatch = useCallback((matchId: string) => {
    router.push(`/match/${matchId}`);
  }, []);

  const handleLogOutcome = useCallback(
    (match: MatchPick, outcome: OutcomeKey, odds: number) => {
      setDraftBet({
        match: `${match.home} vs ${match.away}`,
        pick: outcome,
        odds,
        tag: match.league,
      });
      router.push('/bet-log');
    },
    [setDraftBet]
  );

  const handleToggleSearch = useCallback(() => {
    setIsSearchVisible((prev) => {
      if (prev) {
        setSearchQuery('');
      }
      return !prev;
    });
  }, []);

  return {
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
  };
}
