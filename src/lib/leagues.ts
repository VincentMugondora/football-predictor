import type { MatchPick } from '@/data/types';

export const LEAGUE_FILTERS = [
  'All',
  'Premier League',
  'La Liga',
  'Serie A',
  'Bundesliga',
  'Ligue 1',
  'Championship',
  'Eredivisie',
  'Primeira Liga',
] as const;

/** League chips for the leagues that actually have matches, in a fixed order. */
export function leagueFiltersFor(matches: readonly MatchPick[] | undefined): string[] {
  if (!matches || matches.length === 0) return [...LEAGUE_FILTERS];
  const present = new Set(matches.map((match) => match.league));
  const known = LEAGUE_FILTERS.slice(1).filter((league) => present.has(league));
  const listed: readonly string[] = LEAGUE_FILTERS;
  const extra = [...present].filter((league) => !listed.includes(league)).sort();
  return ['All', ...known, ...extra];
}
