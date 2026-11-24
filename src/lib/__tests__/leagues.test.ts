import { LEAGUE_FILTERS, leagueFiltersFor } from '@/lib/leagues';
import type { MatchPick } from '@/data/types';

const match = (league: string) => ({ league }) as unknown as MatchPick;

describe('leagueFiltersFor', () => {
  it('shows every league before data arrives', () => {
    expect(leagueFiltersFor(undefined)).toEqual([...LEAGUE_FILTERS]);
    expect(leagueFiltersFor([])).toEqual([...LEAGUE_FILTERS]);
  });

  it('keeps only leagues with matches, in the fixed order, and appends unknown ones', () => {
    const matches = [
      match('Eredivisie'),
      match('Premier League'),
      match('Ligue 1'),
      match('Scottish Premiership'),
      match('Premier League'),
    ];
    expect(leagueFiltersFor(matches)).toEqual([
      'All',
      'Premier League',
      'Ligue 1',
      'Eredivisie',
      'Scottish Premiership',
    ]);
  });
});
