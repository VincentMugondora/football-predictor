import { router } from 'expo-router';
import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '@/components/AppButton';
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

  const profitSign = metrics.totalProfit > 0 ? '+' : metrics.totalProfit < 0 ? '-' : '';
  const profitFormatted = `${profitSign}$${Math.abs(metrics.totalProfit).toFixed(2)}`;

  const roiPct = metrics.roi * 100;
  const roiSign = roiPct > 0 ? '+' : '';
  const roiFormatted = `${roiSign}${roiPct.toFixed(1)}%`;

  const currentDdPct = (metrics.drawdown.currentDrawdownPct * 100).toFixed(1);
  const maxDdPct = (metrics.drawdown.maxDrawdownPct * 100).toFixed(1);

  return (
    <ScreenContainer>
      <AppHeader />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
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
            title="Fewer than 100 settled bets is mostly luck"
            subtitle={`You have ${metrics.winRateComparison.settledCount} settled bets. Short-term variance dominates small samples.`}
          />
        ) : null}

        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle} accessibilityRole="header">
            Bankroll & Performance
          </Text>
          <AppButton
            label="Settings"
            onPress={() => router.push('/settings')}
            variant="secondary"
            compact
            accessibilityLabel="Open bankroll and threshold settings"
          />
        </View>

        <View style={styles.gridRow}>
          <StatTile
            label="Current Bankroll"
            value={`$${metrics.currentBankroll.toFixed(2)}`}
            sublabel={`Started at $${metrics.startingBankroll.toFixed(2)}`}
          />
          <StatTile
            label="Total Profit"
            value={profitFormatted}
            sublabel="Settled net P/L"
            tone={
              metrics.totalProfit > 0
                ? 'positive'
                : metrics.totalProfit < 0
                  ? 'negative'
                  : 'default'
            }
          />
        </View>

        <View style={styles.gridRow}>
          <StatTile
            label="ROI (Yield)"
            value={roiFormatted}
            sublabel="Profit / settled stake"
            tone={metrics.roi > 0 ? 'positive' : metrics.roi < 0 ? 'negative' : 'default'}
          />
          <StatTile
            label="Drawdown from Peak"
            value={`-${currentDdPct}%`}
            sublabel={`Peak $${metrics.drawdown.peakBankroll.toFixed(2)} • Max DD -${maxDdPct}%`}
            tone={metrics.isDrawdownAlertActive ? 'negative' : 'default'}
          />
        </View>

        <WinRateComparisonCard comparison={metrics.winRateComparison} />

        <DisclaimerFooter />
      </ScrollView>
    </ScreenContainer>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    scrollContent: {
      gap: theme.spacing.md,
      paddingBottom: theme.spacing.xxl,
    },
    sectionHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: theme.spacing.xs,
    },
    sectionTitle: {
      color: theme.colors.textSecondary,
      fontSize: theme.typography.sizes.sectionTitle,
      fontWeight: theme.typography.weights.semibold,
    },
    gridRow: {
      flexDirection: 'row',
      gap: theme.spacing.md,
    },
  });
}
