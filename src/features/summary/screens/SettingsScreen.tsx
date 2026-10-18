import { router } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '@/components/AppButton';
import { AppHeader } from '@/components/AppHeader';
import { AppInput } from '@/components/AppInput';
import { DisclaimerFooter } from '@/components/DisclaimerFooter';
import { InfoBanner } from '@/components/InfoBanner';
import { ScreenContainer } from '@/components/ScreenContainer';
import { useAppStore } from '@/data/store';
import { AppTheme, useAppTheme } from '@/theme/useAppTheme';

export function SettingsScreen() {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const settings = useAppStore((s) => s.settings);
  const updateSettings = useAppStore((s) => s.updateSettings);
  const resetStoreToDefaults = useAppStore((s) => s.resetStoreToDefaults);

  const [startingBankrollInput, setStartingBankrollInput] = useState<string>(
    String(settings.startingBankroll)
  );
  const [usualStakePctInput, setUsualStakePctInput] = useState<string>(
    String(settings.usualStakePct)
  );
  const [maxStakePctInput, setMaxStakePctInput] = useState<string>(
    String(settings.maxStakePct)
  );
  const [drawdownAlertPctInput, setDrawdownAlertPctInput] = useState<string>(
    String(settings.drawdownAlertPct)
  );
  const [edgeThresholdPctInput, setEdgeThresholdPctInput] = useState<string>(
    String(Number((settings.edgeThreshold * 100).toFixed(2)))
  );
  const [savedNotice, setSavedNotice] = useState<boolean>(false);

  const handleSave = () => {
    const startingBankroll = Math.max(1, Number(startingBankrollInput) || 100);
    const usualStakePct = Math.min(100, Math.max(0.1, Number(usualStakePctInput) || 2));
    const maxStakePct = Math.min(100, Math.max(0.5, Number(maxStakePctInput) || 5));
    const drawdownAlertPct = Math.min(
      95,
      Math.max(1, Number(drawdownAlertPctInput) || 20)
    );
    const edgeThresholdPct = Math.min(
      50,
      Math.max(0, Number(edgeThresholdPctInput) || 3)
    );

    updateSettings({
      startingBankroll,
      usualStakePct,
      maxStakePct,
      drawdownAlertPct,
      edgeThreshold: edgeThresholdPct / 100,
    });
    setSavedNotice(true);
  };

  const handleReset = () => {
    resetStoreToDefaults();
    setStartingBankrollInput('100');
    setUsualStakePctInput('2');
    setMaxStakePctInput('5');
    setDrawdownAlertPctInput('20');
    setEdgeThresholdPctInput('3');
    setSavedNotice(false);
  };

  return (
    <ScreenContainer>
      <AppHeader title="Settings" showBack />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}>
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Bankroll & Risk Rules</Text>

          <AppInput
            label="Starting Bankroll ($)"
            value={startingBankrollInput}
            onChangeText={(val) => {
              setStartingBankrollInput(val);
              setSavedNotice(false);
            }}
            keyboardType="decimal-pad"
            helperText="Baseline bankroll before your logged bets."
          />

          <AppInput
            label="Usual Stake (%)"
            value={usualStakePctInput}
            onChangeText={(val) => {
              setUsualStakePctInput(val);
              setSavedNotice(false);
            }}
            keyboardType="decimal-pad"
            helperText="Default percentage prefilled when logging a bet."
          />

          <AppInput
            label="Max Stake Warning (%)"
            value={maxStakePctInput}
            onChangeText={(val) => {
              setMaxStakePctInput(val);
              setSavedNotice(false);
            }}
            keyboardType="decimal-pad"
            helperText="Warns before saving a bet that exceeds this % of bankroll."
          />

          <AppInput
            label="Drawdown Alert (%)"
            value={drawdownAlertPctInput}
            onChangeText={(val) => {
              setDrawdownAlertPctInput(val);
              setSavedNotice(false);
            }}
            keyboardType="decimal-pad"
            helperText="Triggers the 'Stop and review' alert on the Summary screen."
          />

          <AppInput
            label="Edge Threshold (%)"
            value={edgeThresholdPctInput}
            onChangeText={(val) => {
              setEdgeThresholdPctInput(val);
              setSavedNotice(false);
            }}
            keyboardType="decimal-pad"
            helperText="Highlights match outcomes where (Model % - Break-even %) meets or exceeds this value."
          />

          {savedNotice ? (
            <InfoBanner
              tone="info"
              title="Settings saved to device"
              subtitle="Your thresholds and bankroll parameters have been updated."
            />
          ) : null}

          <View style={styles.actionsRow}>
            <AppButton
              label="Reset Demo Data"
              onPress={handleReset}
              variant="secondary"
              accessibilityLabel="Reset bets and settings to initial demo defaults"
            />
            <AppButton
              label="Save Settings"
              onPress={handleSave}
              variant="primary"
              accessibilityLabel="Save settings"
            />
          </View>
        </View>

        <View style={styles.doneRow}>
          <AppButton
            label="Back to App"
            onPress={() => {
              if (router.canGoBack()) {
                router.back();
              } else {
                router.replace('/');
              }
            }}
            variant="ghost"
          />
        </View>

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
    card: {
      backgroundColor: theme.colors.surface,
      borderColor: theme.colors.border,
      borderWidth: theme.layout.borderWidth,
      borderRadius: theme.radii.card,
      padding: theme.spacing.lg,
      gap: theme.spacing.md,
      marginTop: theme.spacing.xs,
    },
    sectionTitle: {
      color: theme.colors.textPrimary,
      fontSize: theme.typography.sizes.sectionTitle,
      fontWeight: theme.typography.weights.bold,
    },
    actionsRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: theme.spacing.sm,
      marginTop: theme.spacing.xs,
    },
    doneRow: {
      alignItems: 'center',
    },
  });
}
