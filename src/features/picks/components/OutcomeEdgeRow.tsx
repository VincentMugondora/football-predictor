import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { OutcomeKey } from '@/data/types';
import {
  calculateBreakEvenProbability,
  calculateExpectedValue,
  OutcomeAnalysis,
} from '@/lib/calculations';
import { AppTheme, useAppTheme } from '@/theme/useAppTheme';

export interface OutcomeEdgeRowProps {
  analysis: OutcomeAnalysis;
  onLogPress: (outcome: OutcomeKey, odds: number) => void;
  matchTitle: string;
}

export function OutcomeEdgeRow({
  analysis,
  onLogPress,
  matchTitle,
}: OutcomeEdgeRowProps) {
  const theme = useAppTheme();
  const [customOddsInput, setCustomOddsInput] = useState<string>(
    analysis.odds > 1 ? analysis.odds.toFixed(2) : ''
  );

  const parsedCustomOdds = Number(customOddsInput);
  const activeOdds =
    Number.isFinite(parsedCustomOdds) && parsedCustomOdds > 1.0
      ? parsedCustomOdds
      : analysis.odds;

  const modelPct = Math.round(analysis.modelProb * 100);
  const breakEvenProb = calculateBreakEvenProbability(activeOdds);
  const breakEvenPct = Math.round(breakEvenProb * 100);
  const edge = calculateExpectedValue(analysis.modelProb, activeOdds);
  const edgePct = edge * 100;
  const edgeSign = edgePct > 0 ? '+' : '';
  const edgeText = `${edgeSign}${edgePct.toFixed(1)}%`;
  const isValuePick = edge >= 0.03;

  const styles = useMemo(
    () => createStyles(theme, modelPct, isValuePick, edgePct),
    [theme, modelPct, isValuePick, edgePct]
  );

  const displayOutcome =
    analysis.outcome === 'Home'
      ? 'Home win'
      : analysis.outcome === 'Away'
        ? 'Away win'
        : 'Draw';

  return (
    <View
      style={styles.rowContainer}
      accessible={true}
      accessibilityLabel={`${displayOutcome}: Model ${modelPct}%, Break-even ${breakEvenPct}% at odds ${activeOdds.toFixed(2)}, Edge ${edgeText}${isValuePick ? ', Value edge above threshold' : ''}`}
    >
      <View style={styles.topLine}>
        <Text style={styles.outcomeLabel}>{displayOutcome}</Text>
        <View style={styles.track}>
          <View style={styles.fill} />
        </View>
        <Text style={styles.modelPctText}>{modelPct}%</Text>
      </View>

      <View style={styles.bottomLine}>
        <View style={styles.metricsGroup}>
          <View style={styles.oddsInputWrap}>
            <Text style={styles.metaText}>Odds</Text>
            <TextInput
              style={styles.oddsInput}
              value={customOddsInput}
              onChangeText={setCustomOddsInput}
              keyboardType="decimal-pad"
              accessibilityLabel={`Enter MWOS decimal odds for ${displayOutcome} in ${matchTitle}`}
            />
          </View>
          <Text style={styles.metaDot}>•</Text>
            <Text style={styles.metaText}>{activeOdds > 1 ? `BE ${breakEvenPct}%` : 'Enter odds for BE'}</Text>
          <Text style={styles.metaDot}>•</Text>
          <Text style={styles.edgeBadgeText}>
            Edge {edgeText} {isValuePick ? '▲ VALUE' : ''}
          </Text>
        </View>

        <TouchableOpacity
          style={styles.logButton}
          onPress={() => onLogPress(analysis.outcome, activeOdds)}
          accessibilityRole="button"
          accessibilityLabel={`Log ${analysis.outcome} bet for ${matchTitle} at odds ${activeOdds.toFixed(2)}`}
        >
          <Text style={styles.logButtonText}>+ Log</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function createStyles(
  theme: AppTheme,
  modelPct: number,
  isValuePick: boolean,
  edgePct: number
) {
  const edgeColor = isValuePick
    ? theme.colors.primary
    : edgePct < 0
      ? theme.colors.danger
      : theme.colors.textSecondary;

  return StyleSheet.create({
    rowContainer: {
      backgroundColor: isValuePick ? theme.colors.surfaceBanner : 'transparent',
      borderColor: isValuePick ? theme.colors.borderAccent : theme.colors.border,
      borderWidth: isValuePick ? theme.layout.borderWidth : 0,
      borderRadius: theme.radii.banner,
      paddingHorizontal: isValuePick ? theme.spacing.sm : 0,
      paddingVertical: theme.spacing.xs,
      gap: theme.spacing.xs,
    },
    topLine: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
    },
    outcomeLabel: {
      width: 72,
      color: theme.colors.textSecondary,
      fontSize: theme.typography.sizes.body,
      fontWeight: theme.typography.weights.medium,
    },
    track: {
      flex: 1,
      height: theme.layout.progressBarHeight,
      backgroundColor: theme.colors.neutralBarTrack,
      borderRadius: theme.radii.pill,
      overflow: 'hidden',
    },
    fill: {
      width: `${Math.min(100, Math.max(4, modelPct))}%`,
      height: '100%',
      backgroundColor: isValuePick ? theme.colors.primary : theme.colors.neutralBadge,
      borderRadius: theme.radii.pill,
    },
    modelPctText: {
      width: 42,
      textAlign: 'right',
      color: isValuePick ? theme.colors.primary : theme.colors.textPrimary,
      fontSize: theme.typography.sizes.bodyStrong,
      fontWeight: theme.typography.weights.bold,
    },
    bottomLine: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: theme.spacing.sm,
    },
    metricsGroup: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: theme.spacing.xs,
      flex: 1,
    },
    oddsInputWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.xs,
    },
    oddsInput: {
      minWidth: 54,
      paddingHorizontal: theme.spacing.xs,
      paddingVertical: theme.spacing.xxs,
      borderRadius: theme.radii.xs,
      borderWidth: theme.layout.borderWidth,
      borderColor: theme.colors.borderAccent,
      backgroundColor: theme.colors.surfaceElevated,
      color: theme.colors.textPrimary,
      fontSize: theme.typography.sizes.caption,
      fontWeight: theme.typography.weights.bold,
      textAlign: 'center',
    },
    metaText: {
      color: theme.colors.textSecondary,
      fontSize: theme.typography.sizes.caption,
    },
    metaDot: {
      color: theme.colors.textMuted,
      fontSize: theme.typography.sizes.caption,
    },
    edgeBadgeText: {
      color: edgeColor,
      fontSize: theme.typography.sizes.caption,
      fontWeight: theme.typography.weights.bold,
    },
    logButton: {
      minHeight: theme.layout.minTouchTarget,
      minWidth: 64,
      paddingHorizontal: theme.spacing.md,
      borderRadius: theme.radii.pill,
      backgroundColor: isValuePick ? theme.colors.primary : theme.colors.surfaceElevated,
      borderColor: isValuePick ? theme.colors.primary : theme.colors.border,
      borderWidth: theme.layout.borderWidth,
      alignItems: 'center',
      justifyContent: 'center',
    },
    logButtonText: {
      color: isValuePick ? theme.colors.primaryTextOnColor : theme.colors.textPrimary,
      fontSize: theme.typography.sizes.caption,
      fontWeight: theme.typography.weights.bold,
    },
  });
}
