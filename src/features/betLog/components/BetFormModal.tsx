import React, { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { AppButton } from '@/components/AppButton';
import { AppInput } from '@/components/AppInput';
import { InfoBanner } from '@/components/InfoBanner';
import { OutcomeKey } from '@/data/types';
import { BetFormValidationResult } from '@/lib/validation';
import { AppTheme, useAppTheme } from '@/theme/useAppTheme';

const OUTCOMES: readonly OutcomeKey[] = ['Home', 'Draw', 'Away'];

export interface BetFormModalProps {
  match: string;
  onChangeMatch: (val: string) => void;
  pick: OutcomeKey;
  onChangePick: (val: OutcomeKey) => void;
  oddsInput: string;
  onChangeOdds: (val: string) => void;
  stakeInput: string;
  onChangeStake: (val: string) => void;
  tag: string;
  onChangeTag: (val: string) => void;
  currentBankroll: number;
  maxStakePct: number;
  validation: BetFormValidationResult;
  hasSubmittedAttempt: boolean;
  awaitingMaxStakeConfirm: boolean;
  onSubmit: (forceConfirmMaxStake?: boolean) => void;
  onCancel: () => void;
}

export function BetFormModal({
  match,
  onChangeMatch,
  pick,
  onChangePick,
  oddsInput,
  onChangeOdds,
  stakeInput,
  onChangeStake,
  tag,
  onChangeTag,
  currentBankroll,
  maxStakePct,
  validation,
  hasSubmittedAttempt,
  awaitingMaxStakeConfirm,
  onSubmit,
  onCancel,
}: BetFormModalProps) {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={styles.card} accessible={true} accessibilityLabel="Log a bet form">
      <View style={styles.headerRow}>
        <Text style={styles.title}>Log Bet</Text>
        <Text style={styles.bankrollHint}>Bankroll: ${currentBankroll.toFixed(2)}</Text>
      </View>

      <AppInput
        label="Match"
        value={match}
        onChangeText={onChangeMatch}
        placeholder="e.g. Arsenal vs Liverpool"
        error={hasSubmittedAttempt ? validation.errors.match : undefined}
        accessibilityLabel="Match teams"
      />

      <View style={styles.outcomeGroup}>
        <Text style={styles.fieldLabel}>Outcome Pick</Text>
        <View style={styles.outcomePillsRow}>
          {OUTCOMES.map((option) => {
            const selected = option === pick;
            return (
              <TouchableOpacity
                key={option}
                style={[
                  styles.outcomePill,
                  selected ? styles.outcomePillActive : styles.outcomePillInactive,
                ]}
                onPress={() => onChangePick(option)}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={`Select outcome ${option}`}
              >
                <Text
                  style={[
                    styles.outcomePillText,
                    selected
                      ? styles.outcomePillTextActive
                      : styles.outcomePillTextInactive,
                  ]}
                >
                  {option}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <View style={styles.splitRow}>
        <View style={styles.halfCol}>
          <AppInput
            label="Decimal Odds (> 1.00)"
            value={oddsInput}
            onChangeText={onChangeOdds}
            keyboardType="decimal-pad"
            placeholder="2.10"
            error={hasSubmittedAttempt ? validation.errors.odds : undefined}
            accessibilityLabel="Decimal odds"
          />
        </View>
        <View style={styles.halfCol}>
          <AppInput
            label="Stake ($)"
            value={stakeInput}
            onChangeText={onChangeStake}
            keyboardType="decimal-pad"
            placeholder="2.00"
            error={hasSubmittedAttempt ? validation.errors.stake : undefined}
            helperText={`Max recommended: ${maxStakePct}% ($${((currentBankroll * maxStakePct) / 100).toFixed(2)})`}
            accessibilityLabel="Bet stake"
          />
        </View>
      </View>

      <AppInput
        label="League / Tag"
        value={tag}
        onChangeText={onChangeTag}
        placeholder="e.g. Premier League"
        accessibilityLabel="League or tag"
      />

      {awaitingMaxStakeConfirm ||
      (validation.exceedsMaxStakePct && hasSubmittedAttempt) ? (
        <InfoBanner
          tone="warning"
          title={`Stake is ${validation.stakePctOfBankroll.toFixed(1)}% of bankroll (above your ${maxStakePct}% max stake setting)`}
          subtitle="Tap 'Confirm & Save Anyway' below if you still want to log this bet."
        />
      ) : null}

      <View style={styles.actionsRow}>
        <AppButton label="Cancel" onPress={onCancel} variant="secondary" />
        {awaitingMaxStakeConfirm ? (
          <AppButton
            label="Confirm & Save Anyway"
            onPress={() => onSubmit(true)}
            variant="primary"
            accessibilityLabel="Confirm stake above max percent and save bet"
          />
        ) : (
          <AppButton
            label="Save Bet"
            onPress={() => onSubmit(false)}
            variant="primary"
            accessibilityLabel="Save bet"
          />
        )}
      </View>
    </View>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    card: {
      backgroundColor: theme.colors.surface,
      borderColor: theme.colors.borderAccent,
      borderWidth: theme.layout.borderWidth,
      borderRadius: theme.radii.card,
      padding: theme.spacing.lg,
      gap: theme.spacing.md,
      marginBottom: theme.spacing.md,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    title: {
      color: theme.colors.textPrimary,
      fontSize: theme.typography.sizes.sectionTitle,
      fontWeight: theme.typography.weights.bold,
    },
    bankrollHint: {
      color: theme.colors.primary,
      fontSize: theme.typography.sizes.caption,
      fontWeight: theme.typography.weights.semibold,
    },
    fieldLabel: {
      color: theme.colors.textSecondary,
      fontSize: theme.typography.sizes.caption,
      fontWeight: theme.typography.weights.semibold,
    },
    outcomeGroup: {
      gap: theme.spacing.xs,
    },
    outcomePillsRow: {
      flexDirection: 'row',
      gap: theme.spacing.sm,
    },
    outcomePill: {
      flex: 1,
      minHeight: theme.layout.minTouchTarget,
      borderRadius: theme.radii.banner,
      borderWidth: theme.layout.borderWidth,
      alignItems: 'center',
      justifyContent: 'center',
    },
    outcomePillActive: {
      backgroundColor: theme.colors.primary,
      borderColor: theme.colors.primary,
    },
    outcomePillInactive: {
      backgroundColor: theme.colors.surfaceElevated,
      borderColor: theme.colors.border,
    },
    outcomePillText: {
      fontSize: theme.typography.sizes.bodyStrong,
      fontWeight: theme.typography.weights.bold,
    },
    outcomePillTextActive: {
      color: theme.colors.primaryTextOnColor,
    },
    outcomePillTextInactive: {
      color: theme.colors.textPrimary,
    },
    splitRow: {
      flexDirection: 'row',
      gap: theme.spacing.md,
    },
    halfCol: {
      flex: 1,
    },
    actionsRow: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: theme.spacing.sm,
      marginTop: theme.spacing.xs,
    },
  });
}
