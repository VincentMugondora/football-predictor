import { HistoryEntry, MatchResultComparison } from '@/data/types';

export type HistoryPeriod = '7' | '30' | 'season';
export type HistoryShow = 'all' | 'wrong' | 'pending';

export interface HistoryFilters {
  period: HistoryPeriod;
  league: string; // 'All' or a league name
  show: HistoryShow;
}

export interface CalibrationBucket {
  label: string;
  said: number; // average chance we gave, 0-1
  happened: number; // how often it happened, 0-1
  count: number;
}

export interface HistoryStats {
  finished: number;
  pending: number;
  rightWinner: number;
  rightMargin: number;
  exactScore: number;
  draws: number;
  drawsSpotted: number;
  bookCompared: number;
  bookRight: number;
  modelRightOnBookSet: number;
  modelLogLoss: number | null;
  bookLogLoss: number | null;
  calibration: CalibrationBucket[];
}

const PERIOD_DAYS: Record<HistoryPeriod, number | null> = { '7': 7, '30': 30, season: null };
const OUTCOME_INDEX = { Home: 0, Draw: 1, Away: 2 } as const;
const BUCKETS: [number, number, string][] = [
  [0.2, 0.4, '20–40%'],
  [0.4, 0.6, '40–60%'],
  [0.6, 0.8, '60–80%'],
  [0.8, 1.01, '80%+'],
];

/** Season = since 1 July, the usual start of a European season. */
function seasonStart(now: Date): number {
  const year = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
  return new Date(year, 6, 1).getTime();
}

export function filterHistory(
  entries: HistoryEntry[],
  filters: HistoryFilters,
  now: Date = new Date()
): HistoryEntry[] {
  const days = PERIOD_DAYS[filters.period];
  const since = days === null ? seasonStart(now) : now.getTime() - days * 24 * 60 * 60 * 1000;
  return entries.filter((entry) => {
    if (entry.status === 'no_result') return false;
    const kickoff = new Date(entry.date).getTime();
    if (Number.isNaN(kickoff) || kickoff < since) return false;
    if (filters.league !== 'All' && entry.league !== filters.league) return false;
    if (filters.show === 'wrong') return entry.status === 'final' && entry.hit_winner === false;
    if (filters.show === 'pending') return entry.status === 'pending';
    return true;
  });
}

export function computeHistoryStats(entries: HistoryEntry[]): HistoryStats {
  const finished = entries.filter((e) => e.status === 'final' && e.actual_outcome);
  const buckets = BUCKETS.map(([lo, hi, label]) => ({ lo, hi, label, count: 0, said: 0, hit: 0 }));
  const stats: HistoryStats = {
    finished: finished.length,
    pending: entries.filter((e) => e.status === 'pending').length,
    rightWinner: 0,
    rightMargin: 0,
    exactScore: 0,
    draws: 0,
    drawsSpotted: 0,
    bookCompared: 0,
    bookRight: 0,
    modelRightOnBookSet: 0,
    modelLogLoss: null,
    bookLogLoss: null,
    calibration: [],
  };
  let modelLl = 0;
  let bookLl = 0;
  for (const entry of finished) {
    if (entry.hit_winner) stats.rightWinner += 1;
    if (entry.hit_margin) stats.rightMargin += 1;
    if (entry.hit_score) stats.exactScore += 1;
    if (entry.actual_outcome === 'Draw') {
      stats.draws += 1;
      if (entry.pick === 'draw') stats.drawsSpotted += 1;
    }
    if (entry.book_favourite && typeof entry.book_log_loss === 'number') {
      stats.bookCompared += 1;
      if (entry.book_correct) stats.bookRight += 1;
      if (entry.hit_winner) stats.modelRightOnBookSet += 1;
      modelLl += entry.log_loss ?? 0;
      bookLl += entry.book_log_loss;
    }
    const actual = OUTCOME_INDEX[entry.actual_outcome as keyof typeof OUTCOME_INDEX];
    entry.p.forEach((chance, index) => {
      const bucket = buckets.find((b) => chance >= b.lo && chance < b.hi);
      if (!bucket) return;
      bucket.count += 1;
      bucket.said += chance;
      if (index === actual) bucket.hit += 1;
    });
  }
  if (stats.bookCompared > 0) {
    stats.modelLogLoss = modelLl / stats.bookCompared;
    stats.bookLogLoss = bookLl / stats.bookCompared;
  }
  stats.calibration = buckets
    .filter((b) => b.count > 0)
    .map((b) => ({ label: b.label, said: b.said / b.count, happened: b.hit / b.count, count: b.count }));
  return stats;
}

export function historyLeagues(entries: HistoryEntry[]): string[] {
  return Array.from(new Set(entries.map((e) => e.league).filter(Boolean))).sort();
}

/** Keeps only well-formed comparisons so one bad row never breaks the Results screen. */
export function sanitizeComparisons(value: unknown): MatchResultComparison[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is MatchResultComparison => {
    if (!item || typeof item !== 'object') return false;
    const c = item as Partial<MatchResultComparison>;
    return (
      typeof c.id === 'string' &&
      typeof c.home === 'string' &&
      typeof c.away === 'string' &&
      typeof c.actual_score === 'string' &&
      /^\d+\s*-\s*\d+$/.test(c.actual_score) &&
      (c.actual_outcome === 'Home' || c.actual_outcome === 'Draw' || c.actual_outcome === 'Away') &&
      (c.predicted_outcome === 'Home' || c.predicted_outcome === 'Draw' || c.predicted_outcome === 'Away') &&
      Array.isArray(c.p) &&
      c.p.length === 3 &&
      typeof c.correct === 'boolean'
    );
  });
}

/** "Arsenal by 1", "Draw" or "Arsenal win" for a saved prediction. */
export function historyPickLabel(entry: Pick<HistoryEntry, 'pick' | 'home' | 'away' | 'margin'>): string {
  if (entry.pick === 'draw') return 'Draw';
  if (entry.pick === 'too close to call' || entry.pick === null) return 'Too close to call';
  const team = entry.pick === 'away' ? entry.away : entry.home;
  return entry.margin ? `${team} by ${entry.margin}` : `${team} win`;
}

/** "Arsenal by 2" or "Draw" for a final score like "3-1". */
export function resultLabel(home: string, away: string, score: string | undefined): string {
  if (!score) return '';
  const [h, a] = score.split('-').map((part) => Number(part.trim()));
  if (!Number.isFinite(h) || !Number.isFinite(a)) return '';
  if (h === a) return 'Draw';
  return `${h > a ? home : away} by ${Math.abs(h - a)}`;
}
