import React, { memo, useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { ResultIconBadge } from '@/components/ResultIconBadge';
import { TeamCrest } from '@/components/TeamCrest';
import { BetRecord, BetResult } from '@/data/types';
import { calculateBetProfit } from '@/lib/calculations';
import { AppTheme, useAppTheme } from '@/theme/useAppTheme';

const RESULTS: readonly BetResult[] = ['Pending', 'Win', 'Loss', 'Void'];

function parseTeams(matchStr: string): [string, string] {
  const parts = matchStr.split(/\s+vs\.?\s+|\s+v\s+/i);
  if (parts.length >= 2) {
    return [parts[0].trim(), parts.slice(1).join(' vs ').trim()];
  }
  return [matchStr.trim(), 'Opponent'];
}

export interface BetRowCardProps {
  bet: BetRecord;
  onChangeResult: (id: string, result: BetResult) => void;
  onDelete: (id: string) => void;
}

function BetRowCardComponent({ bet, onChangeResult, onDelete }: BetRowCardProps) {
  const theme = useAppTheme();
  const profit = calculateBetProfit(bet);
  const styles = useMemo(() => createStyles(theme, profit), [theme, profit]);

  const [homeTeam, awayTeam] = parseTeams(bet.match);
  const profitSign = profit > 0 ? '+' : profit < 0 ? '-' : '';
  const profitDisplay = `${profitSign}$${Math.abs(profit).toFixed(2)}`;

  return (
    <View
      style={styles.card}
      accessible={true}
      accessibilityLabel={`Bet on ${bet.match}, Pick ${bet.pick}, Odds ${bet.odds.toFixed(2)}, Stake $${bet.stake.toFixed(2)}, Result ${bet.result}, Net ${profitDisplay}`}>
      {/* Top row modeled closely on Image 2 Result Card */}
      <View style={styles.mainRow}>
        <View style={styles.clubsBox}>
          <View style={styles.clubCol}>
            <TeamCrest teamName={homeTeam} size="sm" />
            <Text style={styles.clubName} numberOfLines={1}>
              {homeTeam}
            </Text>
          </View>

          <View style={styles.scoreCol}>
            <Text style={styles.scoreText}>{bet.scoreline ?? 'VS'}</Text>
            <Text style={styles.ftLabel}>
              {bet.result === 'Pending' ? 'OPEN' : 'FT'}
            </Text>
          </View>

          <View style={styles.clubCol}>
            <TeamCrest teamName={awayTeam} size="sm" />
            <Text style={styles.clubName} numberOfLines={1}>
              {awayTeam}
            </Text>
          </View>
        </View>

        <View style={styles.predictedCol}>
          <Text style={styles.predictedLabel}>Predicted:</Text>
          <Text style={styles.predictedValue}>{bet.pick}</Text>
          <Text style={styles.profitText}>{profitDisplay}</Text>
        </View>

        <ResultIconBadge result={bet.result} />
      </View>

      {/* Stake, Odds, Tag & Delete row */}
      <View style={styles.metaRow}>
        <Text style={styles.metaText}>
          Stake ${bet.stake.toFixed(2)} @ {bet.odds.toFixed(2)} • {bet.tag}
        </Text>
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={() => onDelete(bet.id)}
          accessibilityRole="button"
          accessibilityLabel={`Delete bet on ${bet.match}`}>
          <Text style={styles.deleteText}>Delete</Text>
        </TouchableOpacity>
      </View>

      {/* Interactive Result Switcher */}
      <View style={styles.statusRow}>
        {RESULTS.map((statusOption) => {
          const isSelected = bet.result === statusOption;
          return (
            <TouchableOpacity
              key={statusOption}
              style={[
                styles.statusChip,
                isSelected ? styles.statusChipActive : styles.statusChipInactive,
              ]}
              onPress={() => onChangeResult(bet.id, statusOption)}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
              accessibilityLabel={`Mark bet on ${bet.match} as ${statusOption}`}>
              <Text
                style={[
                  styles.statusChipText,
                  isSelected ? styles.statusChipTextActive : styles.statusChipTextInactive,
                ]}>
                {statusOption}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

export const BetRowCard = memo(BetRowCardComponent);

function createStyles(theme: AppTheme, profit: number) {
  const profitColor =
    profit > 0
      ? theme.colors.primary
      : profit < 0
        ? theme.colors.danger
        : theme.colors.textSecondary;

  return StyleSheet.create({
    card: {
      backgroundColor: theme.colors.surface,
      borderColor: theme.colors.border,
      borderWidth: theme.layout.borderWidth,
      borderRadius: theme.radii.card,
      padding: theme.spacing.md,
      gap: theme.spacing.sm,
      marginBottom: theme.spacing.md,
    },
    mainRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: theme.spacing.sm,
    },
    clubsBox: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    clubCol: {
      width: 76,
      alignItems: 'center',
      gap: theme.spacing.xs,
    },
    clubName: {
      color: theme.colors.textPrimary,
      fontSize: theme.typography.sizes.caption,
      fontWeight: theme.typography.weights.semibold,
      textAlign: 'center',
    },
    scoreCol: {
      alignItems: 'center',
      gap: theme.spacing.xxs,
      paddingHorizontal: theme.spacing.xs,
    },
    scoreText: {
      color: theme.colors.textPrimary,
      fontSize: theme.typography.sizes.screenTitle,
      fontWeight: theme.typography.weights.bold,
    },
    ftLabel: {
      color: theme.colors.textSecondary,
      fontSize: theme.typography.sizes.caption,
    },
    predictedCol: {
      alignItems: 'center',
      paddingHorizontal: theme.spacing.xs,
      gap: theme.spacing.xxs,
    },
    predictedLabel: {
      color: theme.colors.textSecondary,
      fontSize: theme.typography.sizes.caption,
    },
    predictedValue: {
      color: theme.colors.textPrimary,
      fontSize: theme.typography.sizes.bodyStrong,
      fontWeight: theme.typography.weights.semibold,
    },
    profitText: {
      color: profitColor,
      fontSize: theme.typography.sizes.caption,
      fontWeight: theme.typography.weights.bold,
    },
    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderTopColor: theme.colors.border,
      borderTopWidth: theme.layout.borderWidth,
      paddingTop: theme.spacing.xs,
    },
    metaText: {
      color: theme.colors.textSecondary,
      fontSize: theme.typography.sizes.caption,
      flex: 1,
    },
    deleteButton: {
      minHeight: theme.layout.minTouchTarget,
      minWidth: theme.layout.minTouchTarget,
      paddingHorizontal: theme.spacing.sm,
      alignItems: 'center',
      justifyContent: 'center',
    },
    deleteText: {
      color: theme.colors.danger,
      fontSize: theme.typography.sizes.caption,
      fontWeight: theme.typography.weights.bold,
    },
    statusRow: {
      flexDirection: 'row',
      gap: theme.spacing.xs,
    },
    statusChip: {
      flex: 1,
      minHeight: theme.layout.minTouchTarget,
      borderRadius: theme.radii.banner,
      borderWidth: theme.layout.borderWidth,
      alignItems: 'center',
      justifyContent: 'center',
    },
    statusChipActive: {
      backgroundColor: theme.colors.primaryMuted,
      borderColor: theme.colors.primary,
    },
    statusChipInactive: {
      backgroundColor: theme.colors.surfaceElevated,
      borderColor: theme.colors.border,
    },
    statusChipText: {
      fontSize: theme.typography.sizes.caption,
      fontWeight: theme.typography.weights.bold,
    },
    statusChipTextActive: {
      color: theme.colors.primary,
    },
    statusChipTextInactive: {
      color: theme.colors.textSecondary,
    },
  });
}
