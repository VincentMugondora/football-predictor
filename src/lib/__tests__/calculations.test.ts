import { describe, expect, it } from '@jest/globals';

import {
  analyzeMatchOutcomes,
  calculateBetProfit,
  calculateBreakEvenProbability,
  calculateDrawdownFromPeak,
  calculateExpectedValue,
  calculateProbabilityEdge,
  calculateROI,
  calculateRunningBankroll,
  calculateTotalProfit,
  calculateWinRateVsBreakEven,
} from '@/lib/calculations';

describe('calculations pure functions', () => {
  describe('calculateExpectedValue', () => {
    it('computes p * odds - 1 accurately', () => {
      expect(calculateExpectedValue(0.5, 2.2)).toBeCloseTo(0.1, 5);
      expect(calculateExpectedValue(0.46, 2.4)).toBeCloseTo(0.104, 5);
    });

    it('returns 0 for non-positive inputs', () => {
      expect(calculateExpectedValue(0, 2.0)).toBe(0);
      expect(calculateExpectedValue(0.5, 0)).toBe(0);
    });
  });

  describe('calculateBreakEvenProbability', () => {
    it('computes 1 / odds for valid decimal odds > 1', () => {
      expect(calculateBreakEvenProbability(2.0)).toBeCloseTo(0.5, 5);
      expect(calculateBreakEvenProbability(2.5)).toBeCloseTo(0.4, 5);
    });

    it('returns 0 when odds <= 1', () => {
      expect(calculateBreakEvenProbability(1)).toBe(0);
      expect(calculateBreakEvenProbability(0.8)).toBe(0);
    });
  });

  describe('calculateProbabilityEdge', () => {
    it('computes p - (1 / odds)', () => {
      expect(calculateProbabilityEdge(0.46, 2.4)).toBeCloseTo(0.46 - 1 / 2.4, 5);
    });
  });

  describe('calculateBetProfit', () => {
    it('returns stake * (odds - 1) on Win', () => {
      expect(calculateBetProfit({ odds: 2.5, stake: 10, result: 'Win' })).toBeCloseTo(
        15,
        5
      );
    });

    it('returns -stake on Loss', () => {
      expect(calculateBetProfit({ odds: 2.5, stake: 10, result: 'Loss' })).toBe(-10);
    });

    it('returns 0 on Pending or Void', () => {
      expect(calculateBetProfit({ odds: 2.5, stake: 10, result: 'Pending' })).toBe(0);
      expect(calculateBetProfit({ odds: 2.5, stake: 10, result: 'Void' })).toBe(0);
    });
  });

  describe('calculateTotalProfit & calculateROI', () => {
    const sampleBets = [
      { odds: 2.0, stake: 10, result: 'Win' as const }, // +10
      { odds: 2.5, stake: 10, result: 'Loss' as const }, // -10
      { odds: 3.0, stake: 10, result: 'Win' as const }, // +20
      { odds: 2.0, stake: 50, result: 'Pending' as const }, // 0 (ignored in ROI denominator)
    ];

    it('sums settled net profit', () => {
      expect(calculateTotalProfit(sampleBets)).toBeCloseTo(20, 5);
    });

    it('divides net profit by settled stake only', () => {
      // Settled stake = 30, profit = 20 -> ROI = 20 / 30 = 0.6667
      expect(calculateROI(sampleBets)).toBeCloseTo(20 / 30, 4);
    });
  });

  describe('calculateWinRateVsBreakEven', () => {
    it('computes win rate vs mean break-even probability on settled bets', () => {
      const bets = [
        { odds: 2.0, stake: 5, result: 'Win' as const }, // BE 0.5
        { odds: 2.0, stake: 5, result: 'Win' as const }, // BE 0.5
        { odds: 2.5, stake: 5, result: 'Loss' as const }, // BE 0.4
        { odds: 1.8, stake: 5, result: 'Void' as const }, // ignored
      ];
      const res = calculateWinRateVsBreakEven(bets);
      expect(res.settledCount).toBe(3);
      expect(res.winRate).toBeCloseTo(2 / 3, 5);
      expect(res.breakEvenRate).toBeCloseTo((0.5 + 0.5 + 0.4) / 3, 5);
      expect(res.delta).toBeCloseTo(2 / 3 - 1.4 / 3, 5);
    });
  });

  describe('calculateRunningBankroll & calculateDrawdownFromPeak', () => {
    const chronologicalBets = [
      {
        odds: 2.0,
        stake: 20,
        result: 'Win' as const,
        createdAt: '2026-10-01T10:00:00Z',
      }, // 100 -> 120 (peak)
      {
        odds: 2.0,
        stake: 30,
        result: 'Loss' as const,
        createdAt: '2026-10-02T10:00:00Z',
      }, // 120 -> 90 (drawdown 30/120 = 25%)
      {
        odds: 2.0,
        stake: 10,
        result: 'Win' as const,
        createdAt: '2026-10-03T10:00:00Z',
      }, // 90 -> 100 (current drawdown 20/120 = 16.67%)
    ];

    it('builds chronological bankroll curve', () => {
      const curve = calculateRunningBankroll(100, chronologicalBets);
      expect(curve).toEqual([100, 120, 90, 100]);
    });

    it('tracks peak bankroll, current drawdown, and max drawdown', () => {
      const dd = calculateDrawdownFromPeak(100, chronologicalBets);
      expect(dd.peakBankroll).toBe(120);
      expect(dd.currentBankroll).toBe(100);
      expect(dd.maxDrawdownPct).toBeCloseTo(0.25, 5);
      expect(dd.currentDrawdownPct).toBeCloseTo(20 / 120, 5);
    });
  });

  describe('analyzeMatchOutcomes', () => {
    it('flags outcomes whose edge meets or exceeds the threshold', () => {
      const outcomes = analyzeMatchOutcomes([0.46, 0.27, 0.27], [2.4, 3.6, 3.85], 0.03);
      // Home: 0.46 - 1/2.4 (0.4167) = +0.0433 >= 0.03 -> true
      expect(outcomes[0].isValuePick).toBe(true);
      // Draw: 0.27 - 1/3.6 (0.2778) = -0.0078 -> false
      expect(outcomes[1].isValuePick).toBe(false);
    });
  });
});
