export type OutcomeTuple = [number, number, number]; // [Home, Draw, Away]

export type OutcomeKey = 'Home' | 'Draw' | 'Away';

export type FormResult = 'W' | 'D' | 'L';

export interface MatchKeyStats {
  goalsPerGame: [number, number];
  shots: [number, number];
  possession: [number, number];
}

export interface MatchPick {
  id: string;
  date: string; // ISO 8601 timestamp
  league: string;
  home: string;
  away: string;
  p: OutcomeTuple; // Model probabilities [H, D, A] in [0, 1]
  odds: OutcomeTuple; // Bookmaker decimal odds [H, D, A]
  featured?: boolean;
  isDemo?: boolean;
  homeForm?: FormResult[];
  awayForm?: FormResult[];
  stats?: MatchKeyStats;
  ourTake?: string;
}

export interface BacktestSummary {
  verdict: string;
  log_loss_model: number;
  log_loss_book: number;
}

export interface PicksPayload {
  generated_at: string;
  backtest: BacktestSummary;
  matches: MatchPick[];
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
  getCachedPicks(): PicksPayload;
  getPicks(): Promise<PicksPayload>;
}
