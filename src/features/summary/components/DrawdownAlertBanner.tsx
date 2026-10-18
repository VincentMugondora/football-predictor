import React from 'react';

import { InfoBanner } from '@/components/InfoBanner';

export interface DrawdownAlertBannerProps {
  currentDrawdownPct: number;
  maxDrawdownPct: number;
  alertThresholdPct: number;
}

export function DrawdownAlertBanner({
  currentDrawdownPct,
  maxDrawdownPct,
  alertThresholdPct,
}: DrawdownAlertBannerProps) {
  const displayPct = Math.max(currentDrawdownPct * 100, maxDrawdownPct * 100).toFixed(1);

  return (
    <InfoBanner
      tone="danger"
      title={`Stop and review: Drawdown (${displayPct}%) reached your ${alertThresholdPct}% alert level`}
      subtitle="Pause logging new bets, inspect your recent stake sizing, and verify model assumptions before continuing."
    />
  );
}
