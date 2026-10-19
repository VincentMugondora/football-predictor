import { BetRecord, OutcomeKey } from '@/data/types';

/**
 * Expected value per unit staked: (probability * decimalOdds) - 1.
 * Returns 0 if inputs are non-positive.
 */
export function calculateExpectedValue(probability: number, odds: number): number {
  if (probability <= 0 || odds <= 0) {
    return 0;
  }
  return probability * odds - 1;
}

/**
 * Implied break-even probability required by decimal odds: 1 / odds.
 * Returns 0 for invalid odds <= 1.
 */
export function calculateBreakEvenProbability(odds: number): number {
  if (odds <= 1) {
    return 0;
  }
  return 1 / odds;
}

/**
 * Probability edge over the bookmaker's break-even rate: p - (1 / odds).
 */
export function calculateProbabilityEdge(probability: number, odds: number): number {
  if (odds <= 1) {
    return 0;
  }
  return probability - calculateBreakEvenProbability(odds);
}

/**
 * Net profit or loss for a single bet based on its settled status.
 * Pending and Void bets contribute 0 net profit.
 */
export function calculateBetProfit(
  bet: Pick<BetRecord, 'odds' | 'stake' | 'result'>
): number {
  if (bet.stake <= 0) {
    return 0;
  }
  switch (bet.result) {
    case 'Win':
      return bet.stake * (bet.odds - 1);
    case 'Loss':
      return -bet.stake;
    case 'Void':
    case 'Pending':
      return 0;
  }
}

/**
 * Total net profit across a list of bets.
 */
export function calculateTotalProfit(
  bets: readonly Pick<BetRecord, 'odds' | 'stake' | 'result'>[]
): number {
  return bets.reduce((sum, bet) => sum + calculateBetProfit(bet), 0);
}

/**
 * Return on Investment (ROI) as a decimal ratio: totalProfit / totalSettledStaked.
 * Only Win and Loss bets count toward active settled capital at risk.
 */
export function calculateROI(
  bets: readonly Pick<BetRecord, 'odds' | 'stake' | 'result'>[]
): number {
  const settledBets = bets.filter((bet) => bet.result === 'Win' || bet.result === 'Loss');
  const totalStaked = settledBets.reduce((sum, bet) => sum + bet.stake, 0);
  if (totalStaked <= 0) {
    return 0;
  }
  const totalProfit = settledBets.reduce((sum, bet) => sum + calculateBetProfit(bet), 0);
  return totalProfit / totalStaked;
}

export interface WinRateComparison {
  settledCount: number;
  winRate: number;
  breakEvenRate: number;
  delta: number;
}

/**
 * Compares actual win rate on settled bets (Win / (Win + Loss)) against the mean
 * break-even probability implied by the odds of those settled bets.
 */
export function calculateWinRateVsBreakEven(
  bets: readonly Pick<BetRecord, 'odds' | 'stake' | 'result'>[]
): WinRateComparison {
  const settled = bets.filter((bet) => bet.result === 'Win' || bet.result === 'Loss');
  if (settled.length === 0) {
    return {
      settledCount: 0,
      winRate: 0,
      breakEvenRate: 0,
      delta: 0,
    };
  }

  const wins = settled.filter((bet) => bet.result === 'Win').length;
  const winRate = wins / settled.length;
  const sumBreakEven = settled.reduce(
    (sum, bet) => sum + calculateBreakEvenProbability(bet.odds),
    0
  );
  const breakEvenRate = sumBreakEven / settled.length;

  return {
    settledCount: settled.length,
    winRate,
    breakEvenRate,
    delta: winRate - breakEvenRate,
  };
}

/**
 * Chronological bankroll trajectory starting from startingBankroll.
 * Bets are sorted oldest-first by createdAt so peak-to-trough drawdown reflects real history.
 */
export function calculateRunningBankroll(
  startingBankroll: number,
  bets: readonly Pick<BetRecord, 'odds' | 'stake' | 'result' | 'createdAt'>[]
): number[] {
  const sorted = [...bets].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  const curve: number[] = [startingBankroll];
  let current = startingBankroll;

  for (const bet of sorted) {
    const delta = calculateBetProfit(bet);
    current = Number((current + delta).toFixed(4));
    curve.push(current);
  }

  return curve;
}

export interface DrawdownSummary {
  currentBankroll: number;
  peakBankroll: number;
  currentDrawdownPct: number; // 0 to 1 (e.g. 0.25 = 25% below peak)
  maxDrawdownPct: number; // Maximum historical peak-to-trough drop (0 to 1)
}

/**
 * Calculates both current drawdown from highest bankroll peak and maximum historical drawdown.
 */
export function calculateDrawdownFromPeak(
  startingBankroll: number,
  bets: readonly Pick<BetRecord, 'odds' | 'stake' | 'result' | 'createdAt'>[]
): DrawdownSummary {
  const curve = calculateRunningBankroll(startingBankroll, bets);
  let peak = startingBankroll > 0 ? startingBankroll : 0;
  let maxDrawdownPct = 0;

  for (const point of curve) {
    if (point > peak) {
      peak = point;
    }
    if (peak > 0) {
      const dd = Math.max(0, (peak - point) / peak);
      if (dd > maxDrawdownPct) {
        maxDrawdownPct = dd;
      }
    }
  }

  const currentBankroll = curve[curve.length - 1] ?? startingBankroll;
  const currentDrawdownPct = peak > 0 ? Math.max(0, (peak - currentBankroll) / peak) : 0;

  return {
    currentBankroll,
    peakBankroll: peak,
    currentDrawdownPct,
    maxDrawdownPct,
  };
}

export interface OutcomeAnalysis {
  outcome: OutcomeKey;
  modelProb: number;
  odds: number;
  breakEvenProb: number;
  edge: number;
  expectedValue: number;
  isValuePick: boolean;
}

/**
 * Builds the 3 outcome evaluations (Home, Draw, Away) for a match given the user's edge threshold.
 */
export function analyzeMatchOutcomes(
  p: [number, number, number],
  odds: [number, number, number],
  edgeThreshold: number
): [OutcomeAnalysis, OutcomeAnalysis, OutcomeAnalysis] {
  const keys: [OutcomeKey, OutcomeKey, OutcomeKey] = ['Home', 'Draw', 'Away'];
  const mapped = keys.map((outcome, idx): OutcomeAnalysis => {
    const modelProb = p[idx] ?? 0;
    const decimalOdds = odds[idx] ?? 0;
    const breakEvenProb = calculateBreakEvenProbability(decimalOdds);
    const edge = calculateProbabilityEdge(modelProb, decimalOdds);
    const expectedValue = calculateExpectedValue(modelProb, decimalOdds);

    return {
      outcome,
      modelProb,
      odds: decimalOdds,
      breakEvenProb,
      edge,
      expectedValue,
      isValuePick: edge >= edgeThreshold,
    };
  });

  return [mapped[0], mapped[1], mapped[2]];
}

/**
 * Formats a probability ratio in [0, 1] as a percentage string (e.g. 0.542 -> "54%" or "54.2%").
 */
export function formatPercentage(ratio: number, decimals = 0): string {
  if (!Number.isFinite(ratio)) {
    return '0%';
  }
  return `${(ratio * 100).toFixed(decimals)}%`;
}
