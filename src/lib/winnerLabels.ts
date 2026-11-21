import { MatchPick } from '@/data/types';

export interface WinnerSummary {
  /** e.g. "Arsenal by 1", "Draw", "Too close to call" */
  headline: string;
  /** e.g. "2-1", or null when no scoreline is published */
  score: string | null;
  /** chance of the pick winning by exactly that margin, 0-1, or null */
  marginChance: number | null;
}

function teamFor(match: MatchPick, pick: 'home' | 'away'): string {
  return pick === 'home' ? match.home : match.away;
}

/** One consistent wording for the predicted winner and margin across every screen. */
export function summariseWinner(match: MatchPick): WinnerSummary | null {
  const winner = match.winner;
  if (!winner) return null;

  if (winner.pick === 'too close to call') {
    return { headline: 'Too close to call', score: null, marginChance: null };
  }

  const margin = winner.margin;
  if (winner.pick === 'draw') {
    return {
      headline: 'Draw',
      score: margin?.score ?? null,
      marginChance: margin ? margin.p : null,
    };
  }

  const team = teamFor(match, winner.pick);
  if (!margin || margin.goals < 1) {
    return { headline: `${team} win`, score: null, marginChance: null };
  }
  return {
    headline: `${team} by ${margin.goals}`,
    score: margin.score,
    marginChance: margin.p,
  };
}

/** "Arsenal by 1 (2-1)" — short form for list rows. */
export function formatWinnerShort(match: MatchPick): string | null {
  const summary = summariseWinner(match);
  if (!summary) return null;
  return summary.score ? `${summary.headline} (${summary.score})` : summary.headline;
}

/** Per-team margin lines, e.g. "Arsenal: by 1 32% · by 2 18% · by 3+ 9%". */
export function formatMarginLines(match: MatchPick): string[] | null {
  const margins = match.winner?.margins;
  if (!margins) return null;
  const pct = (value: number) => `${Math.round(value * 100)}%`;
  const side = (name: string, values: [number, number, number]) =>
    `${name}: by 1 ${pct(values[0])} · by 2 ${pct(values[1])} · by 3+ ${pct(values[2])}`;
  return [side(match.home, margins.home), `Draw: ${pct(margins.draw)}`, side(match.away, margins.away)];
}

export type ConfidenceLevel = 'Likely' | 'Lean' | 'Toss-up';

/** The model's chance for its own pick, 0-1. */
export function pickChance(match: MatchPick): number {
  const p = match.winner?.p ?? match.p;
  const pick = match.winner?.pick;
  if (pick === 'home') return p[0];
  if (pick === 'draw') return p[1];
  if (pick === 'away') return p[2];
  return Math.max(p[0], p[1], p[2]);
}

/**
 * Plain-language confidence for anyone: "Likely" when the pick has a clear lead,
 * "Lean" when it is ahead but not by much, "Toss-up" for close calls or thin history.
 */
export function confidenceLevel(match: MatchPick): ConfidenceLevel {
  const winner = match.winner;
  if (match.low_confidence || !winner || winner.close_call || winner.pick === 'too close to call') {
    return 'Toss-up';
  }
  if (winner.confidence === 'low') return 'Toss-up';
  const chance = pickChance(match);
  if (chance >= 0.55) return 'Likely';
  if (chance >= 0.42) return 'Lean';
  return 'Toss-up';
}

/** "Arsenal to win by 1", "Draw" or "Too close to call": the big line on each card. */
export function formatPredictionHeadline(match: MatchPick): string | null {
  const summary = summariseWinner(match);
  if (!summary) return null;
  if (summary.headline === 'Draw' || summary.headline === 'Too close to call') return summary.headline;
  const pick = match.winner?.pick;
  const team = pick === 'away' ? match.away : match.home;
  const goals = match.winner?.margin?.goals;
  return goals && goals > 0 ? `${team} to win by ${goals}` : `${team} to win`;
}

/** Most likely score with an en dash, e.g. "2–1", or null. */
export function formatLikelyScore(match: MatchPick): string | null {
  const score = match.winner?.margin?.score ?? match.goals?.top_scores?.[0]?.score ?? null;
  return score ? score.replace('-', '–') : null;
}

/** One plain line about goal timing, e.g. "71% chance of a goal before half-time". */
export function formatTimingHeadline(match: MatchPick): string | null {
  const timing = match.timing;
  if (!timing) return null;
  if (timing.halves) {
    return `${Math.round(timing.halves.p_first_half_goal * 100)}% chance of a goal before half-time`;
  }
  if (timing.windows) {
    return `${Math.round(timing.windows.p_first_goal_before_30 * 100)}% chance of a goal in the first 30 minutes`;
  }
  return null;
}
