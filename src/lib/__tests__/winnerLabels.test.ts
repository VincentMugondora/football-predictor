import { describe, expect, it, jest } from '@jest/globals';

import { LivePicksRepository } from '@/data/picksRepository';
import { MatchPick } from '@/data/types';
import { formatMarginLines, formatWinnerShort, summariseWinner } from '@/lib/winnerLabels';

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(async () => null),
    setItem: jest.fn(async () => undefined),
    removeItem: jest.fn(async () => undefined),
  },
}));

function makeMatch(overrides: Partial<MatchPick> = {}): MatchPick {
  return {
    id: 'm1',
    date: new Date(Date.now() + 86_400_000).toISOString(),
    league: 'Premier League',
    home: 'Arsenal',
    away: 'Chelsea',
    p: [0.55, 0.25, 0.2],
    odds: null,
    winner: {
      pick: 'home',
      p: [0.55, 0.25, 0.2],
      confidence: 'medium',
      close_call: false,
      margin: { goals: 1, p: 0.24, p_given_pick: 0.44, score: '1-0', p_score: 0.11 },
      margins: { home: [0.24, 0.17, 0.14], draw: 0.25, away: [0.12, 0.05, 0.03], exp_goal_diff: 0.6 },
    },
    ...overrides,
  };
}

describe('winner labels', () => {
  it('names the winning team, margin and scoreline', () => {
    const match = makeMatch();
    expect(summariseWinner(match)).toEqual({ headline: 'Arsenal by 1', score: '1-0', marginChance: 0.24 });
    expect(formatWinnerShort(match)).toBe('Arsenal by 1 (1-0)');
  });

  it('handles away wins and draws', () => {
    const away = makeMatch({
      winner: {
        pick: 'away',
        p: [0.2, 0.25, 0.55],
        confidence: 'medium',
        margin: { goals: 2, p: 0.15, p_given_pick: 0.27, score: '0-2', p_score: 0.08 },
      },
    });
    expect(formatWinnerShort(away)).toBe('Chelsea by 2 (0-2)');

    const draw = makeMatch({
      winner: {
        pick: 'draw',
        p: [0.3, 0.4, 0.3],
        confidence: 'low',
        margin: { goals: 0, p: 0.4, p_given_pick: 1, score: '1-1', p_score: 0.13 },
      },
    });
    expect(formatWinnerShort(draw)).toBe('Draw (1-1)');
  });

  it('falls back gracefully for older payloads without margins', () => {
    expect(formatWinnerShort(makeMatch({ winner: { pick: 'home', p: [0.5, 0.3, 0.2], confidence: 'medium' } }))).toBe(
      'Arsenal win'
    );
    expect(
      formatWinnerShort(makeMatch({ winner: { pick: 'too close to call', p: [0.36, 0.3, 0.34], confidence: 'low' } }))
    ).toBe('Too close to call');
    expect(formatMarginLines(makeMatch({ winner: undefined }))).toBeNull();
  });

  it('lists margin chances per team', () => {
    expect(formatMarginLines(makeMatch())).toEqual([
      'Arsenal: by 1 24% · by 2 17% · by 3+ 14%',
      'Draw: 25%',
      'Chelsea: by 1 12% · by 2 5% · by 3+ 3%',
    ]);
  });
});

describe('picks.json margin validation', () => {
  async function load(match: MatchPick) {
    const body = {
      generated_at: new Date(Date.now() - 60_000).toISOString(),
      matches: [match],
      backtest: { verdict: 'No proven edge', log_loss_model: 0.98, log_loss_book: 0.96 },
    };
    const request = jest.fn(async () => ({ ok: true, status: 200, json: async () => body }) as Response);
    const repo = new LivePicksRepository({
      url: 'https://example.test/picks.json',
      request: request as unknown as typeof fetch,
      storage: {
        getItem: jest.fn(async () => null),
        setItem: jest.fn(async () => undefined),
        removeItem: jest.fn(async () => undefined),
      },
    });
    return repo.getPicks();
  }

  it('accepts a consistent winner margin', async () => {
    await expect(load(makeMatch())).resolves.toBeTruthy();
  });

  it('rejects a scoreline that disagrees with the margin', async () => {
    const bad = makeMatch({
      winner: {
        pick: 'home',
        p: [0.55, 0.25, 0.2],
        confidence: 'medium',
        margin: { goals: 1, p: 0.24, p_given_pick: 0.44, score: '2-0', p_score: 0.11 },
      },
    });
    await expect(load(bad)).rejects.toMatchObject({ field: 'matches[0].winner.margin' });
  });
});
