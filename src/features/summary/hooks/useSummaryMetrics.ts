import { useMemo } from 'react';

import { useAppStore } from '@/data/store';
import {
  calculateDrawdownFromPeak,
  calculateROI,
  calculateTotalProfit,
  calculateWinRateVsBreakEven,
  DrawdownSummary,
  WinRateComparison,
} from '@/lib/calculations';

export interface SummaryMetrics {
  startingBankroll: number;
  currentBankroll: number;
  totalProfit: number;
  roi: number;
  winRateComparison: WinRateComparison;
  drawdown: DrawdownSummary;
  isDrawdownAlertActive: boolean;
  isSmallSampleSize: boolean;
  drawdownAlertPct: number;
}

export function useSummaryMetrics(): SummaryMetrics {
  const bets = useAppStore((s) => s.bets);
  const settings = useAppStore((s) => s.settings);

  return useMemo(() => {
    const totalProfit = calculateTotalProfit(bets);
    const roi = calculateROI(bets);
    const winRateComparison = calculateWinRateVsBreakEven(bets);
    const drawdown = calculateDrawdownFromPeak(settings.startingBankroll, bets);

    const activeDrawdownPctValue = Math.max(
      drawdown.currentDrawdownPct * 100,
      drawdown.maxDrawdownPct * 100
    );
    const isDrawdownAlertActive = activeDrawdownPctValue >= settings.drawdownAlertPct;
    const isSmallSampleSize = winRateComparison.settledCount < 100;

    return {
      startingBankroll: settings.startingBankroll,
      currentBankroll: drawdown.currentBankroll,
      totalProfit,
      roi,
      winRateComparison,
      drawdown,
      isDrawdownAlertActive,
      isSmallSampleSize,
      drawdownAlertPct: settings.drawdownAlertPct,
    };
  }, [bets, settings.startingBankroll, settings.drawdownAlertPct]);
}
