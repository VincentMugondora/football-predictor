import { router } from 'expo-router';
import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { AppHeader } from '@/components/AppHeader';
import { DisclaimerFooter } from '@/components/DisclaimerFooter';
import { InfoBanner } from '@/components/InfoBanner';
import { ScreenContainer } from '@/components/ScreenContainer';
import { DrawdownAlertBanner } from '@/features/summary/components/DrawdownAlertBanner';
import { StatTile } from '@/features/summary/components/StatTile';
import { WinRateComparisonCard } from '@/features/summary/components/WinRateComparisonCard';
import { useSummaryMetrics } from '@/features/summary/hooks/useSummaryMetrics';
import { AppTheme, useAppTheme } from '@/theme/useAppTheme';

export function SummaryScreen() {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const metrics = useSummaryMetrics();

  const profitSign = metrics.totalProfit > 0 ? '+' : metrics.totalProfit < 0 ? '−' : '';
  const profitFormatted = `${profitSign}$${Math.abs(metrics.totalProfit).toFixed(2)}`;
  const roiPct = metrics.roi * 100;
  const roiFormatted = `${roiPct > 0 ? '+' : roiPct < 0 ? '−' : ''}${Math.abs(roiPct).toFixed(1)}%`;
  const dipPct = Math.max(metrics.drawdown.currentDrawdownPct, metrics.drawdown.maxDrawdownPct) * 100;
  const settledCount = metrics.winRateComparison.settledCount;

  return (
    <ScreenContainer>
      <AppHeader
        title="Summary"
        showBack
        right={
          <TouchableOpacity
            style={styles.settingsPill}
            onPress={() => router.push('/settings')}
            accessibilityRole="button"
            accessibilityLabel="Open bankroll and threshold settings"
          >
            <Text style={styles.settingsPillText}>Settings</Text>
          </TouchableOpacity>
        }
      />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {metrics.isDrawdownAlertActive ? (
          <DrawdownAlertBanner
            currentDrawdownPct={metrics.drawdown.currentDrawdownPct}
            maxDrawdownPct={metrics.drawdown.maxDrawdownPct}
            alertThresholdPct={metrics.drawdownAlertPct}
          />
        ) : null}

        {metrics.isSmallSampleSize ? (
          <InfoBanner
            tone="info"
            title={`${settledCount} finished ${settledCount === 1 ? 'bet is' : 'bets are'} too few to judge`}
            subtitle="Under about 100 finished bets, wins and losses are mostly luck. Keep logging and check back."
          />
        ) : null}

        <View style={styles.gridRow}>
          <StatTile
            label="Bankroll now"
            value={`$${metrics.currentBankroll.toFixed(2)}`}
            sublabel={`Started at $${metrics.startingBankroll.toFixed(2)}`}
          />
          <StatTile
            label="Total profit"
            value={profitFormatted}
            sublabel="From finished bets"
            tone={metrics.totalProfit > 0 ? 'positive' : metrics.totalProfit < 0 ? 'negative' : 'default'}
          />
        </View>
        <View style={styles.gridRow}>
          <StatTile
            label="Return"
            value={roiFormatted}
            sublabel="Profit ÷ money staked"
            tone={metrics.roi > 0 ? 'positive' : metrics.roi < 0 ? 'negative' : 'default'}
          />
          <StatTile
            label="Biggest dip"
            value={`−${dipPct.toFixed(1)}%`}
            sublabel={`From a peak of $${metrics.drawdown.peakBankroll.toFixed(2)}`}
            tone={metrics.isDrawdownAlertActive ? 'negative' : 'warning'}
          />
        </View>

        <WinRateComparisonCard comparison={metrics.winRateComparison} />

        <Text style={styles.care}>
          Worried about how much you bet? Talk to someone you trust, or set a lower stake in Settings.
        </Text>
        <DisclaimerFooter />
      </ScrollView>
    </ScreenContainer>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    scrollContent: { gap: theme.spacing.lg, paddingBottom: theme.spacing.xxl },
    gridRow: { flexDirection: 'row', gap: 10 },
    settingsPill: {
      minHeight: 40,
      paddingHorizontal: 14,
      borderRadius: 20,
      borderWidth: theme.layout.borderWidth,
      borderColor: theme.colors.borderAccent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    settingsPillText: { color: theme.colors.textPrimary, fontSize: 14, fontWeight: theme.typography.weights.bold },
    care: { color: theme.colors.textMuted, fontSize: 12, lineHeight: 18, textAlign: 'center' },
  });
}
