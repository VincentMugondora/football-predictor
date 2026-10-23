export type OutcomeTuple = [number, number, number]; // [Home, Draw, Away]

export type OutcomeKey = 'Home' | 'Draw' | 'Away';

export type FormResult = 'W' | 'D' | 'L';

export interface MatchKeyStats {
  goalsPerGame: [number, number];
  shots: [number, number];
  possession: [number, number];
}

export interface GoalPrediction {
  exp_home: number;
  exp_away: number;
  exp_total: number;
  p_total: [number, number, number, number, number]; // 0, 1, 2, 3, 4+
  over: { '0.5': number; '1.5': number; '2.5': number; '3.5': number };
  btts: number;
  clean_sheet: [number, number]; // home team, away team
  top_scores: { score: string; probability: number }[];
}

export interface WinnerPrediction {
  pick: 'home' | 'draw' | 'away' | 'too close to call';
  p: OutcomeTuple;
  confidence: 'low' | 'medium' | 'high';
}

export interface HalfTimingPrediction {
  home: { first: number; second: number };
  away: { first: number; second: number };
  p_first_half_goal: number;
  league_first_share: number;
  team_specific_signal: boolean;
}

export type GoalTimeWindow = '0-15' | '16-30' | '31-45+' | '46-60' | '61-75' | '76-90+';

export interface MinuteWindowPrediction {
  home: Record<GoalTimeWindow, { expected_goals: number; p_at_least_one: number }>;
  away: Record<GoalTimeWindow, { expected_goals: number; p_at_least_one: number }>;
  p_first_goal_before_30: number;
  team_specific_signal: boolean;
  league_goal_sample: number;
}

export interface MatchTimingPrediction {
  level: 'minute' | 'half' | 'none';
  halves: HalfTimingPrediction | null;
  windows: MinuteWindowPrediction | null;
  note: string;
}

export interface MatchPick {
  id: string;
  date: string; // ISO 8601 timestamp
  league: string;
  home: string;
  away: string;
  p: OutcomeTuple; // Model probabilities [H, D, A] in [0, 1]
  odds: OutcomeTuple | null; // Optional validated reference odds [H, D, A]
  featured?: boolean;
  low_confidence?: boolean;
  homeForm?: FormResult[];
  awayForm?: FormResult[];
  stats?: MatchKeyStats;
  ourTake?: string;
  updatedAtLabel?: string;
  reference_source?: string;
  fair_odds?: OutcomeTuple;
  goals?: GoalPrediction;
  winner?: WinnerPrediction;
  timing?: MatchTimingPrediction;
}

export interface MatchResultComparison {
  id: string;
  date: string;
  league: string;
  home: string;
  away: string;
  p: OutcomeTuple;
  odds: OutcomeTuple;
  predicted_outcome: OutcomeKey;
  actual_score: string;
  actual_outcome: OutcomeKey;
  correct: boolean;
  book_favourite: OutcomeKey;
  book_correct: boolean;
  log_loss: number;
  brier: number;
}

export interface BacktestSummary {
  verdict: string;
  log_loss_model: number;
  log_loss_book: number | null;
  test_matches?: number;
  bookmaker_test_matches?: number;
  gap?: number | null;
  verdict_code?: string;
  clv_mean?: number;
  recent_evaluated?: number;
  recent_hit_rate_model?: number;
  recent_hit_rate_book?: number;
  winner?: Record<string, unknown>;
  goals?: Record<string, unknown>;
  timing?: Record<string, unknown>;
}

export interface PicksPayload {
  schema_version?: string;
  model_version?: string;
  generated_at: string;
  data_status?: 'ok' | 'no_fixtures';
  sources_used?: string[];
  leagues_skipped?: Record<string, string>;
  odds_credits_remaining?: number | null;
  backtest: BacktestSummary;
  matches: MatchPick[];
  recent_comparisons?: MatchResultComparison[];
  model_notes?: Record<string, string>;
}

export type BetResult = 'Pending' | 'Win' | 'Loss' | 'Void';

export interface BetRecord {
  id: string;
  match: string;
  pick: OutcomeKey;
  odds: number;
  stake: number;
  tag: string;
  result: BetResult;
  createdAt: string;
  scoreline?: string;
}

export interface BetDraft {
  match: string;
  pick: OutcomeKey;
  odds: number;
  tag: string;
}

export interface UserSettings {
  startingBankroll: number;
  usualStakePct: number; // e.g., 2 means 2% of current bankroll
  maxStakePct: number; // e.g., 5 means warn above 5% of current bankroll
  drawdownAlertPct: number; // e.g., 20 means alert when drawdown >= 20%
  edgeThreshold: number; // e.g., 0.03 means 3.0% probability edge
}

export interface PicksRepository {
  getCachedPicks(): PicksPayload | null;
  getPicks(): Promise<PicksPayload>;
}
