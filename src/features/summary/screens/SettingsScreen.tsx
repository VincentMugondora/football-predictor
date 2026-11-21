import Constants from 'expo-constants';
import { Href, router } from 'expo-router';
import React, { useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { AppHeader } from '@/components/AppHeader';
import { AppInput } from '@/components/AppInput';
import { DisclaimerFooter } from '@/components/DisclaimerFooter';
import { InfoBanner } from '@/components/InfoBanner';
import { ScreenContainer } from '@/components/ScreenContainer';
import { SectionCard } from '@/components/SectionCard';
import { useAppStore } from '@/data/store';
import { AppTheme, useAppTheme } from '@/theme/useAppTheme';

const ADMIN_TAPS = 5;
const TAP_WINDOW_MS = 2500;

export function SettingsScreen() {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const settings = useAppStore((s) => s.settings);
  const updateSettings = useAppStore((s) => s.updateSettings);
  const resetStoreToDefaults = useAppStore((s) => s.resetStoreToDefaults);

  const [startingBankrollInput, setStartingBankrollInput] = useState(String(settings.startingBankroll));
  const [usualStakePctInput, setUsualStakePctInput] = useState(String(settings.usualStakePct));
  const [maxStakePctInput, setMaxStakePctInput] = useState(String(settings.maxStakePct));
  const [drawdownAlertPctInput, setDrawdownAlertPctInput] = useState(String(settings.drawdownAlertPct));
  const [edgeThresholdPctInput, setEdgeThresholdPctInput] = useState(
    String(Number((settings.edgeThreshold * 100).toFixed(2)))
  );
  const [savedNotice, setSavedNotice] = useState(false);
  const taps = useRef<number[]>([]);

  const bankrollNumber = Number(startingBankrollInput) || settings.startingBankroll;
  const stakeNumber = Number(usualStakePctInput) || settings.usualStakePct;
  const version = Constants.expoConfig?.version ?? '1.0.0';

  const edit = (setter: (value: string) => void) => (value: string) => {
    setter(value);
    setSavedNotice(false);
  };

  const handleSave = () => {
    const startingBankroll = Math.max(1, Number(startingBankrollInput) || 100);
    const usualStakePct = Math.min(100, Math.max(0.1, Number(usualStakePctInput) || 2));
    const maxStakePct = Math.min(100, Math.max(0.5, Number(maxStakePctInput) || 5));
    const drawdownAlertPct = Math.min(95, Math.max(1, Number(drawdownAlertPctInput) || 20));
    const edgeThresholdPct = Math.min(50, Math.max(0, Number(edgeThresholdPctInput) || 3));
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

  // Hidden admin entry: tap the version line 5 times within a few seconds.
  const handleVersionTap = () => {
    const now = Date.now();
    taps.current = [...taps.current.filter((t) => now - t < TAP_WINDOW_MS), now];
    if (taps.current.length >= ADMIN_TAPS) {
      taps.current = [];
      router.push('/admin' as Href);
    }
  };

  return (
    <ScreenContainer>
      <AppHeader title="Settings" showBack hideSettings />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.titleBlock}>
          <Text style={styles.title} accessibilityRole="header">
            Money and limits
          </Text>
          <Text style={styles.subtitle}>
            These stay on your phone. They power the Summary and the warnings you see.
          </Text>
        </View>

        <SectionCard>
          <AppInput
            label="Starting bankroll ($)"
            value={startingBankrollInput}
            onChangeText={edit(setStartingBankrollInput)}
            keyboardType="decimal-pad"
            helperText="The money you set aside for betting."
          />
          <AppInput
            label="Usual stake (% of bankroll)"
            value={usualStakePctInput}
            onChangeText={edit(setUsualStakePctInput)}
            keyboardType="decimal-pad"
            helperText={`At $${bankrollNumber.toFixed(0)} that is $${((bankrollNumber * stakeNumber) / 100).toFixed(2)} a bet.`}
          />
          <AppInput
            label="Warn me above (% of bankroll)"
            value={maxStakePctInput}
            onChangeText={edit(setMaxStakePctInput)}
            keyboardType="decimal-pad"
            helperText="We warn you before you log a bigger bet."
          />
          <AppInput
            label="Alert after a drop of (%)"
            value={drawdownAlertPctInput}
            onChangeText={edit(setDrawdownAlertPctInput)}
            keyboardType="decimal-pad"
            helperText="We show a stop-and-review alert if your bankroll falls this far from its peak."
          />
          <AppInput
            label="Highlight a gap of at least (points)"
            value={edgeThresholdPctInput}
            onChangeText={edit(setEdgeThresholdPctInput)}
            keyboardType="decimal-pad"
            helperText="How much our chance must beat the bookmakers’ before we point it out."
          />
          {savedNotice ? (
            <InfoBanner tone="info" title="Settings saved" subtitle="Your limits have been updated on this phone." />
          ) : null}
        </SectionCard>

        <TouchableOpacity
          style={styles.primaryButton}
          onPress={handleSave}
          accessibilityRole="button"
          accessibilityLabel="Save settings"
        >
          <Text style={styles.primaryButtonText}>Save settings</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.dangerButton}
          onPress={handleReset}
          accessibilityRole="button"
          accessibilityLabel="Reset bets and settings to initial demo defaults"
        >
          <Text style={styles.dangerButtonText}>Reset demo data</Text>
        </TouchableOpacity>

        <SectionCard title="About the predictions">
          <Text style={styles.body}>
            A statistical model trained on past results, updated twice a day. Data: football-data.co.uk,
            football-data.org and The Odds API.
          </Text>
        </SectionCard>

        <Pressable onPress={handleVersionTap} accessibilityRole="text" accessibilityLabel={`App version ${version}`}>
          <Text style={styles.version}>MatchSense version {version}</Text>
        </Pressable>
        <DisclaimerFooter />
      </ScrollView>
    </ScreenContainer>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    scrollContent: { gap: theme.spacing.lg, paddingBottom: theme.spacing.xxl },
    titleBlock: { gap: 4 },
    title: { color: theme.colors.textPrimary, fontSize: 26, fontWeight: '900' },
    subtitle: { color: theme.colors.textSecondary, fontSize: 14, lineHeight: 20 },
    body: { color: theme.colors.textSecondary, fontSize: 13, lineHeight: 19 },
    primaryButton: {
      minHeight: 52,
      borderRadius: 14,
      backgroundColor: theme.colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    primaryButtonText: { color: theme.colors.primaryTextOnColor, fontSize: 16, fontWeight: theme.typography.weights.bold },
    dangerButton: {
      minHeight: 48,
      borderRadius: 14,
      borderWidth: theme.layout.borderWidth,
      borderColor: theme.colors.borderDanger,
      alignItems: 'center',
      justifyContent: 'center',
    },
    dangerButtonText: { color: theme.colors.dangerText, fontSize: 15, fontWeight: theme.typography.weights.bold },
    version: { color: theme.colors.textMuted, fontSize: 12, textAlign: 'center', paddingVertical: theme.spacing.sm },
  });
}
