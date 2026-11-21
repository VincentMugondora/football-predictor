import React, { memo, useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { BetRecord, BetResult } from '@/data/types';
import { calculateBetProfit } from '@/lib/calculations';
import { formatShortDayAndMonth } from '@/lib/dateUtils';
import { AppTheme, useAppTheme } from '@/theme/useAppTheme';

const RESULTS: readonly BetResult[] = ['Pending', 'Win', 'Loss', 'Void'];
const RESULT_LABELS: Record<BetResult, string> = { Pending: 'Pending', Win: 'Won', Loss: 'Lost', Void: 'Void' };

function parseTeams(matchStr: string): [string, string] {
  const parts = matchStr.split(/\s+vs\.?\s+|\s+v\s+/i);
  if (parts.length >= 2) {
    return [parts[0].trim(), parts.slice(1).join(' vs ').trim()];
  }
  return [matchStr.trim(), ''];
}

function pickName(bet: BetRecord): string {
  const [home, away] = parseTeams(bet.match);
  if (bet.pick === 'Draw') return 'Draw';
  if (bet.pick === 'Home') return home || 'Home';
  return away || 'Away';
}

export interface BetRowCardProps {
  bet: BetRecord;
  onChangeResult: (id: string, result: BetResult) => void;
  onDelete: (id: string) => void;
}

function BetRowCardComponent({ bet, onChangeResult, onDelete }: BetRowCardProps) {
  const theme = useAppTheme();
  const profit = calculateBetProfit(bet);
  const styles = useMemo(() => createStyles(theme), [theme]);
  const profitSign = profit > 0 ? '+' : profit < 0 ? '−' : '';
  const profitDisplay = `${profitSign}$${Math.abs(profit).toFixed(2)}`;
  const statusStyle =
    bet.result === 'Win' ? styles.statusWon : bet.result === 'Loss' ? styles.statusLost : styles.statusOther;
  const statusTextStyle =
    bet.result === 'Win' ? styles.statusTextWon : bet.result === 'Loss' ? styles.statusTextLost : styles.statusTextOther;

  return (
    <View
      style={styles.card}
      accessible={false}
      accessibilityLabel={`Bet on ${bet.match}, Pick ${bet.pick}, Odds ${bet.odds.toFixed(2)}, Stake $${bet.stake.toFixed(2)}, Result ${bet.result}, Net ${profitDisplay}`}
    >
      <View style={styles.topRow}>
        <Text style={styles.meta}>
          {formatShortDayAndMonth(bet.createdAt)}
          {bet.tag ? ` · ${bet.tag}` : ''}
        </Text>
        <View style={[styles.status, statusStyle]}>
          <Text style={[styles.statusText, statusTextStyle]}>{RESULT_LABELS[bet.result].toUpperCase()}</Text>
        </View>
      </View>
      <View style={styles.titleRow}>
        <Text style={styles.title} numberOfLines={2}>
          {bet.match}
        </Text>
        {bet.scoreline ? <Text style={styles.score}>{bet.scoreline.replace(/\s*-\s*/, '–')}</Text> : null}
      </View>
      <View style={styles.facts}>
        <View style={styles.fact}>
          <Text style={styles.factLabel}>Your pick</Text>
          <Text style={styles.factValue} numberOfLines={1}>
            {pickName(bet)}
          </Text>
        </View>
        <View style={styles.fact}>
          <Text style={styles.factLabel}>Odds</Text>
          <Text style={styles.factValue}>{bet.odds.toFixed(2)}</Text>
        </View>
        <View style={styles.fact}>
          <Text style={styles.factLabel}>Stake</Text>
          <Text style={styles.factValue}>${bet.stake.toFixed(2)}</Text>
        </View>
        <View style={styles.fact}>
          <Text style={styles.factLabel}>Net</Text>
          <Text
            style={[
              styles.factValue,
              profit > 0 ? styles.positive : profit < 0 ? styles.negative : null,
            ]}
          >
            {bet.result === 'Pending' ? '–' : profitDisplay}
          </Text>
        </View>
      </View>
      <View style={styles.actionsRow}>
        <View style={styles.statusChips}>
          {RESULTS.map((statusOption) => {
            const isSelected = bet.result === statusOption;
            return (
              <TouchableOpacity
                key={statusOption}
                style={[styles.chip, isSelected ? styles.chipActive : null]}
                onPress={() => onChangeResult(bet.id, statusOption)}
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
                accessibilityLabel={`Mark bet on ${bet.match} as ${statusOption}`}
              >
                <Text style={[styles.chipText, isSelected ? styles.chipTextActive : null]}>
                  {RESULT_LABELS[statusOption]}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={() => onDelete(bet.id)}
          accessibilityRole="button"
          accessibilityLabel={`Delete bet on ${bet.match}`}
        >
          <Text style={styles.deleteText}>Delete</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export const BetRowCard = memo(BetRowCardComponent);

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    card: {
      gap: 10,
      padding: theme.spacing.lg,
      borderRadius: 18,
      backgroundColor: theme.colors.surface,
      borderWidth: theme.layout.borderWidth,
      borderColor: theme.colors.border,
      marginBottom: theme.spacing.md,
    },
    topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    meta: { color: theme.colors.textSecondary, fontSize: 13, flexShrink: 1 },
    status: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: theme.radii.pill },
    statusWon: { backgroundColor: theme.colors.winSurface },
    statusLost: { backgroundColor: theme.colors.surfaceDangerBanner },
    statusOther: { backgroundColor: theme.colors.neutralBarTrack },
    statusText: { fontSize: 11, fontWeight: '900', letterSpacing: 0.6 },
    statusTextWon: { color: theme.colors.formWin },
    statusTextLost: { color: theme.colors.dangerText },
    statusTextOther: { color: theme.colors.tossUpText },
    titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: theme.spacing.sm },
    title: { flex: 1, color: theme.colors.textPrimary, fontSize: 17, fontWeight: theme.typography.weights.bold },
    score: { color: theme.colors.textPrimary, fontSize: 20, fontWeight: '900' },
    facts: {
      flexDirection: 'row',
      gap: theme.spacing.sm,
      padding: theme.spacing.md,
      borderRadius: 12,
      backgroundColor: theme.colors.surfaceElevated,
    },
    fact: { flex: 1, gap: 2 },
    factLabel: { color: theme.colors.textSecondary, fontSize: 12 },
    factValue: { color: theme.colors.textPrimary, fontSize: 15, fontWeight: theme.typography.weights.bold },
    positive: { color: theme.colors.formWin },
    negative: { color: theme.colors.dangerText },
    actionsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: theme.spacing.sm },
    statusChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, flex: 1 },
    chip: {
      minHeight: 36,
      paddingHorizontal: 12,
      borderRadius: theme.radii.pill,
      borderWidth: theme.layout.borderWidth,
      borderColor: theme.colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    chipActive: { backgroundColor: theme.colors.primaryMuted, borderColor: theme.colors.primary },
    chipText: { color: theme.colors.textSecondary, fontSize: 13 },
    chipTextActive: { color: theme.colors.primary, fontWeight: theme.typography.weights.bold },
    deleteButton: { minHeight: theme.layout.minTouchTarget, justifyContent: 'center', paddingHorizontal: theme.spacing.sm },
    deleteText: { color: theme.colors.dangerText, fontSize: 13, fontWeight: theme.typography.weights.bold },
  });
}
