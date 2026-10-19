import { Ionicons } from '@expo/vector-icons';
import React, { memo, useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { TeamCrest } from '@/components/TeamCrest';
import { MatchPick, OutcomeKey } from '@/data/types';
import { OutcomeEdgeRow } from '@/features/picks/components/OutcomeEdgeRow';
import { StackedProbBar } from '@/features/picks/components/StackedProbBar';
import { analyzeMatchOutcomes } from '@/lib/calculations';
import { AppTheme, useAppTheme } from '@/theme/useAppTheme';

export interface PredictionMatchCardProps {
  match: MatchPick;
  edgeThreshold: number;
  updatedFallbackLabel: string;
  onPressMatch: (matchId: string) => void;
  onLogOutcome: (match: MatchPick, outcome: OutcomeKey, odds: number) => void;
}

function PredictionMatchCardComponent({
  match,
  edgeThreshold,
  updatedFallbackLabel,
  onPressMatch,
  onLogOutcome,
}: PredictionMatchCardProps) {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [showEdges, setShowEdges] = useState(false);

  const outcomes = useMemo(
    () => analyzeMatchOutcomes(match.p, match.odds, edgeThreshold),
    [match.p, match.odds, edgeThreshold]
  );

  const matchTitle = `${match.home} vs ${match.away}`;
  const updatedText = match.updatedAtLabel ?? updatedFallbackLabel;

  return (
    <View style={[styles.card, theme.shadows.card]}>
      <TouchableOpacity
        style={styles.teamsRow}
        onPress={() => onPressMatch(match.id)}
        accessibilityRole="button"
        accessibilityLabel={`View prediction details for ${matchTitle}`}
      >
        <View style={styles.teamCol}>
          <TeamCrest teamName={match.home} size="lg" />
          <Text style={styles.teamName} numberOfLines={1}>
            {match.home}
          </Text>
        </View>

        <Text style={styles.versusText}>v</Text>

        <View style={styles.teamCol}>
          <TeamCrest teamName={match.away} size="lg" />
          <Text style={styles.teamName} numberOfLines={1}>
            {match.away}
          </Text>
        </View>
      </TouchableOpacity>

      <StackedProbBar probabilities={match.p} />

      <View style={styles.footerRow}>
        <View style={styles.updatedGroup}>
          <Ionicons name="time-outline" size={15} color={theme.colors.textSecondary} />
          <Text style={styles.updatedText}>{updatedText}</Text>
        </View>

        <TouchableOpacity
          style={styles.edgeToggleBtn}
          onPress={() => setShowEdges((prev) => !prev)}
          accessibilityRole="button"
          accessibilityLabel={
            showEdges
              ? `Hide bookmaker odds and edge for ${matchTitle}`
              : `Show bookmaker odds and edge for ${matchTitle}`
          }
        >
          <Text style={styles.edgeToggleText}>
            {showEdges ? 'Hide odds' : 'Odds & Edge'}
          </Text>
          <Ionicons
            name={showEdges ? 'chevron-up' : 'chevron-down'}
            size={14}
            color={theme.colors.primary}
          />
        </TouchableOpacity>
      </View>

      {showEdges ? (
        <View style={styles.edgesContainer}>
          {outcomes.map((item) => (
            <OutcomeEdgeRow
              key={item.outcome}
              analysis={item}
              matchTitle={matchTitle}
              onLogPress={(outcome, odds) => onLogOutcome(match, outcome, odds)}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

export const PredictionMatchCard = memo(PredictionMatchCardComponent);

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    card: {
      backgroundColor: theme.colors.surface,
      borderColor: theme.colors.border,
      borderWidth: theme.layout.borderWidth,
      borderRadius: theme.radii.card,
      padding: theme.spacing.lg,
      gap: theme.spacing.lg,
      marginBottom: theme.spacing.md,
    },
    teamsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingTop: theme.spacing.xs,
    },
    teamCol: {
      flex: 1,
      alignItems: 'center',
      gap: theme.spacing.sm,
    },
    teamName: {
      color: theme.colors.textPrimary,
      fontSize: theme.typography.sizes.bodyStrong,
      lineHeight: theme.typography.lineHeights.bodyStrong,
      fontWeight: theme.typography.weights.bold,
      textAlign: 'center',
    },
    versusText: {
      color: theme.colors.textSecondary,
      fontSize: theme.typography.sizes.sectionTitle,
      fontWeight: theme.typography.weights.semibold,
      paddingHorizontal: theme.spacing.md,
    },
    footerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingTop: theme.spacing.xxs,
    },
    updatedGroup: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.xs,
    },
    updatedText: {
      color: theme.colors.textSecondary,
      fontSize: theme.typography.sizes.caption,
      fontWeight: theme.typography.weights.medium,
    },
    edgeToggleBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.xs,
      paddingVertical: theme.spacing.xs,
      paddingHorizontal: theme.spacing.sm,
      borderRadius: theme.radii.pill,
      backgroundColor: theme.colors.primaryMuted,
    },
    edgeToggleText: {
      color: theme.colors.primary,
      fontSize: theme.typography.sizes.caption,
      fontWeight: theme.typography.weights.semibold,
    },
    edgesContainer: {
      borderTopColor: theme.colors.border,
      borderTopWidth: theme.layout.borderWidth,
      paddingTop: theme.spacing.sm,
      gap: theme.spacing.xs,
    },
  });
}
