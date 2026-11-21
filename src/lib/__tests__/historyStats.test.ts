import { describe, expect, it } from '@jest/globals';

import { HistoryEntry } from '@/data/types';
import {
  computeHistoryStats,
  filterHistory,
  historyLeagues,
  historyPickLabel,
  resultLabel,
  sanitizeComparisons,
} from '@/lib/historyStats';

const NOW = new Date('2026-11-22T12:00:00Z');

function entry(overrides: Partial<HistoryEntry>): HistoryEntry {
  return {
    id: 'x',
    date: '2026-11-20T15:00:00Z',
    league: 'Premier League',
    home: 'Arsenal',
    away: 'Chelsea',
    p: [0.55, 0.25, 0.2],
    odds: [1.9, 3.6, 4.3],
    pick: 'home',
    margin: 1,
    score: '2-1',
    status: 'final',
    actual_score: '2-1',
    actual_outcome: 'Home',
    predicted_outcome: 'Home',
    hit_winner: true,
    hit_margin: true,
    hit_score: true,
    log_loss: 0.6,
    brier: 0.3,
    book_favourite: 'Home',
    book_correct: true,
    book_log_loss: 0.65,
    ...overrides,
  };
}

const entries: HistoryEntry[] = [
  entry({ id: 'a' }),
  entry({
    id: 'b',
    actual_score: '0-2',
    actual_outcome: 'Away',
    hit_winner: false,
    hit_margin: false,
    hit_score: false,
    book_correct: false,
    log_loss: 1.6,
    book_log_loss: 1.4,
  }),
  entry({
    id: 'c',
    league: 'La Liga',
    pick: 'draw',
    margin: 0,
    score: '1-1',
    actual_score: '1-1',
    actual_outcome: 'Draw',
    book_favourite: undefined,
    book_log_loss: undefined,
  }),
  entry({ id: 'd', date: '2026-11-23T15:00:00Z', status: 'pending', actual_outcome: undefined }),
  entry({ id: 'e', date: '2026-09-01T15:00:00Z' }),
  entry({ id: 'f', status: 'no_result' }),
];

describe('history stats', () => {
  it('filters by period, league and what to show', () => {
    const base = { period: '30' as const, league: 'All', show: 'all' as const };
    expect(filterHistory(entries, base, NOW).map((e) => e.id)).toEqual(['a', 'b', 'c', 'd']);
    expect(filterHistory(entries, { ...base, period: 'season' }, NOW).map((e) => e.id)).toContain('e');
    expect(filterHistory(entries, { ...base, league: 'La Liga' }, NOW).map((e) => e.id)).toEqual(['c']);
    expect(filterHistory(entries, { ...base, show: 'wrong' }, NOW).map((e) => e.id)).toEqual(['b']);
    expect(filterHistory(entries, { ...base, show: 'pending' }, NOW).map((e) => e.id)).toEqual(['d']);
  });

  it('counts right winners, margins, scores, draws and the bookmaker comparison', () => {
    const stats = computeHistoryStats(filterHistory(entries, { period: '30', league: 'All', show: 'all' }, NOW));
    expect(stats.finished).toBe(3);
    expect(stats.pending).toBe(1);
    expect(stats.rightWinner).toBe(2);
    expect(stats.rightMargin).toBe(2);
    expect(stats.exactScore).toBe(2);
    expect(stats.draws).toBe(1);
    expect(stats.drawsSpotted).toBe(1);
    expect(stats.bookCompared).toBe(2);
    expect(stats.bookRight).toBe(1);
    expect(stats.modelRightOnBookSet).toBe(1);
    expect(stats.modelLogLoss).toBeCloseTo(1.1);
    expect(stats.bookLogLoss).toBeCloseTo(1.025);
  });

  it('builds honest-chance buckets from every outcome probability', () => {
    const stats = computeHistoryStats([entries[0]]);
    // 0.55 -> 40-60% bucket and it happened; 0.25 and 0.2 -> 20-40% bucket, neither happened.
    const mid = stats.calibration.find((b) => b.label === '40–60%');
    const low = stats.calibration.find((b) => b.label === '20–40%');
    expect(mid).toMatchObject({ count: 1, happened: 1 });
    expect(low).toMatchObject({ count: 2, happened: 0 });
  });

  it('labels picks and results in plain words', () => {
    expect(historyPickLabel({ pick: 'away', home: 'A', away: 'B', margin: 2 })).toBe('B by 2');
    expect(historyPickLabel({ pick: 'draw', home: 'A', away: 'B', margin: 0 })).toBe('Draw');
    expect(resultLabel('A', 'B', '3-1')).toBe('A by 2');
    expect(resultLabel('A', 'B', '1-1')).toBe('Draw');
    expect(historyLeagues(entries)).toEqual(['La Liga', 'Premier League']);
  });

  it('drops malformed comparisons instead of failing', () => {
    const good = {
      id: 'g', date: '2026-11-20T15:00:00Z', league: 'Premier League', home: 'A', away: 'B',
      p: [0.5, 0.3, 0.2], odds: null, predicted_outcome: 'Home', actual_score: '2-0',
      actual_outcome: 'Home', correct: true, book_favourite: null, book_correct: null, log_loss: 0.7, brier: 0.3,
    };
    expect(sanitizeComparisons([good, { id: 'bad' }, null, { ...good, actual_score: 'x' }])).toHaveLength(1);
    expect(sanitizeComparisons(undefined)).toEqual([]);
  });
});
