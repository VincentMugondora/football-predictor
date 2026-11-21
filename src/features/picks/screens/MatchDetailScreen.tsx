import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { AppHeader } from '@/components/AppHeader';
import { ConfidenceTag } from '@/components/ConfidenceTag';
import { DisclaimerFooter } from '@/components/DisclaimerFooter';
import { EmptyState } from '@/components/EmptyState';
import { FormBadge } from '@/components/FormBadge';
import { ScreenContainer } from '@/components/ScreenContainer';
import { SectionCard } from '@/components/SectionCard';
import { TeamCrest } from '@/components/TeamCrest';
import { picksRepository } from '@/data/picksRepository';
import { useAppStore } from '@/data/store';
import { GoalTimeWindow, MatchPick, OutcomeKey } from '@/data/types';
import { OutcomeEdgeRow } from '@/features/picks/components/OutcomeEdgeRow';
import { analyzeMatchOutcomes, impliedFromOdds } from '@/lib/calculations';
import { formatShortDayAndTime } from '@/lib/dateUtils';
import {
  confidenceLevel,
  formatLikelyScore,
  formatPredictionHeadline,
  pickChance,
} from '@/lib/winnerLabels';
import { AppTheme, useAppTheme } from '@/theme/useAppTheme';

const GOAL_TIME_WINDOWS: readonly GoalTimeWindow[] = [
  '0-15',
  '16-30',
  '31-45+',
  '46-60',
  '61-75',
  '76-90+',
];

const pct = (value: number) => `${Math.round(value * 100)}%`;

/** "about 6 times in 10" / "about 1 time in 9" so chances read like everyday odds. */
function timesIn(probability: number): string {
  if (probability >= 0.15) return `about ${Math.round(probability * 10)} times in 10`;
  if (probability <= 0) return 'rarely';
  const n = Math.round(1 / probability);
  return `about 1 time in ${n}`;
}

function predictionSentence(match: MatchPick): string | null {
  const pick = match.winner?.pick;
  if (!pick || pick === 'too close to call') return null;
  const who = pick === 'draw' ? 'it ends in a draw' : `${pick === 'home' ? match.home : match.away} win`;
  let sentence = `In matches like this, ${who} ${timesIn(pickChance(match))}.`;
  const score = formatLikelyScore(match);
  const pScore = match.winner?.margin?.p_score;
  if (score && typeof pScore === 'number') {
    sentence += ` A ${score} score exactly happens ${timesIn(pScore)}.`;
  }
  return sentence;
}

interface BarRowProps {
  label: string;
  value: number;
  highlight?: boolean;
  styles: ReturnType<typeof createStyles>;
  colour?: string;
}

function BarRow({ label, value, highlight = false, styles, colour }: BarRowProps) {
  return (
    <View style={styles.barRow} accessible accessibilityLabel={`${label}: ${pct(value)}`}>
      <View style={styles.barRowTop}>
        <Text style={styles.barLabel}>{label}</Text>
        <Text style={[styles.barValue, highlight ? styles.barValueHighlight : null]}>{pct(value)}</Text>
      </View>
      <View style={styles.track}>
        <View
          style={[
            styles.fill,
            { width: `${Math.min(100, Math.max(0, value * 100))}%` },
            colour ? { backgroundColor: colour } : null,
          ]}
        />
      </View>
    </View>
  );
}

interface StatBoxProps {
  label: string;
  value: string;
  highlight?: boolean;
  styles: ReturnType<typeof createStyles>;
}

function StatBox({ label, value, highlight = false, styles }: StatBoxProps) {
  return (
    <View style={[styles.statBox, highlight ? styles.statBoxHighlight : null]} accessible accessibilityLabel={`${label}: ${value}`}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, highlight ? styles.statValueHighlight : null]}>{value}</Text>
    </View>
  );
}

export function MatchDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [showLogBet, setShowLogBet] = useState(false);
  const edgeThreshold = useAppStore((s) => s.settings.edgeThreshold);
  const setDraftBet = useAppStore((s) => s.setDraftBet);

  const match = useMemo(() => {
    if (!id) {
      return undefined;
    }
    return picksRepository.getMatchById(id);
  }, [id]);

  if (!match) {
    return (
      <ScreenContainer>
        <AppHeader title="Match detail" showBack />
        <EmptyState
          title="Match not found"
          message="This match could not be found in the saved predictions."
          actionLabel="Back to matches"
          onAction={() => router.replace('/')}
        />
      </ScreenContainer>
    );
  }

  const matchTitle = `${match.home} vs ${match.away}`;
  const probs = match.winner?.p ?? match.p;
  const outcomes = analyzeMatchOutcomes(match.p, match.odds, edgeThreshold);
  const headline = formatPredictionHeadline(match);
  const likelyScore = formatLikelyScore(match);
  const sentence = predictionSentence(match);
  const pickIndex =
    match.winner?.pick === 'home' ? 0 : match.winner?.pick === 'draw' ? 1 : match.winner?.pick === 'away' ? 2 : -1;
  const margins = match.winner?.margins ?? null;
  const topMarginKey = margins
    ? (() => {
        const all = [
          ...margins.home.map((v, i) => ({ key: `h${i}`, v })),
          ...margins.away.map((v, i) => ({ key: `a${i}`, v })),
        ];
        return all.reduce((best, cur) => (cur.v > best.v ? cur : best), all[0]).key;
      })()
    : null;
  const windows = match.timing?.windows ?? null;
  const halves = match.timing?.halves ?? null;
  const windowChances = windows
    ? GOAL_TIME_WINDOWS.map((w) => ({
        window: w,
        chance: 1 - (1 - windows.home[w].p_at_least_one) * (1 - windows.away[w].p_at_least_one),
      }))
    : [];
  const busiest = windowChances.reduce<{ window: string; chance: number } | null>(
    (best, cur) => (!best || cur.chance > best.chance ? cur : best),
    null
  );
  const refOdds = match.odds;
  const implied = refOdds ? impliedFromOdds(refOdds) : null;

  const handleLogOutcome = (outcome: OutcomeKey, odds: number) => {
    setDraftBet({ match: matchTitle, pick: outcome, odds, tag: match.league });
    router.push('/bet-log');
  };

  return (
    <ScreenContainer>
      <AppHeader title={matchTitle} subtitle={`${match.league} · ${formatShortDayAndTime(match.date)}`} showBack />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <SectionCard tone="hero">
          <View style={styles.scoreboard} accessible accessibilityLabel={`${matchTitle}${likelyScore ? `, most likely score ${likelyScore}` : ''}`}>
            <View style={styles.teamCol}>
              <TeamCrest teamName={match.home} size="lg" />
              <Text style={styles.teamName} numberOfLines={2}>
                {match.home}
              </Text>
              <Text style={styles.teamSide}>Home</Text>
            </View>
            <View style={styles.centerCol}>
              <Text style={styles.bigScore}>{likelyScore ?? 'vs'}</Text>
              {likelyScore ? <Text style={styles.scoreCaption}>most likely score</Text> : null}
            </View>
            <View style={styles.teamCol}>
              <TeamCrest teamName={match.away} size="lg" />
              <Text style={styles.teamName} numberOfLines={2}>
                {match.away}
              </Text>
              <Text style={styles.teamSide}>Away</Text>
            </View>
          </View>
        </SectionCard>

        {headline ? (
          <SectionCard>
            <View style={styles.rowBetween}>
              <Text style={styles.eyebrow}>OUR PREDICTION</Text>
              <ConfidenceTag level={confidenceLevel(match)} />
            </View>
            <Text style={styles.headline}>{headline}</Text>
            {sentence ? <Text style={styles.body}>{sentence}</Text> : null}
            {match.low_confidence ? (
              <Text style={styles.warningText}>One of these teams has little history in our data, so treat this as a rough guess.</Text>
            ) : null}
          </SectionCard>
        ) : null}

        <SectionCard title="Who wins?">
          <BarRow label={`${match.home} win`} value={probs[0]} highlight={pickIndex === 0} styles={styles} />
          <BarRow label="Draw" value={probs[1]} highlight={pickIndex === 1} styles={styles} colour={theme.colors.probBarDraw} />
          <BarRow label={`${match.away} win`} value={probs[2]} highlight={pickIndex === 2} styles={styles} colour={theme.colors.probBarAway} />
        </SectionCard>

        {margins ? (
          <SectionCard title="By how much?" subtitle="Chance of each winning margin">
            <View style={styles.grid3}>
              {(['h', 'a'] as const).flatMap((side) =>
                [0, 1, 2].map((i) => {
                  const value = side === 'h' ? margins.home[i] : margins.away[i];
                  const team = side === 'h' ? match.home : match.away;
                  return (
                    <StatBox
                      key={`${side}${i}`}
                      label={`${team} by ${i === 2 ? '3+' : i + 1}`}
                      value={pct(value)}
                      highlight={topMarginKey === `${side}${i}`}
                      styles={styles}
                    />
                  );
                })
              )}
            </View>
            <Text style={styles.body}>
              Draw: <Text style={styles.strong}>{pct(margins.draw)}</Text> · Expected goal difference{' '}
              <Text style={styles.strong}>
                {margins.exp_goal_diff >= 0 ? '+' : ''}
                {margins.exp_goal_diff.toFixed(1)}
              </Text>{' '}
              to {match.home}
            </Text>
          </SectionCard>
        ) : null}

        {match.timing ? (
          <SectionCard
            title="When are goals likely?"
            subtitle={windows ? '15-minute windows: chance of at least one goal in each' : 'Goals by half'}
          >
            {windows ? (
              <>
                <View style={styles.chart}>
                  {windowChances.map((w) => {
                    const top = busiest?.window === w.window;
                    return (
                      <View key={w.window} style={styles.chartCol} accessible accessibilityLabel={`${w.window} minutes: ${pct(w.chance)}`}>
                        <Text style={[styles.chartPct, top ? styles.chartPctTop : null]}>{pct(w.chance)}</Text>
                        <View style={[styles.chartBar, { height: Math.max(6, Math.round(w.chance * 110)) }, top ? styles.chartBarTop : null]} />
                        <Text style={styles.chartLabel}>{w.window}</Text>
                      </View>
                    );
                  })}
                </View>
                <View style={styles.grid2}>
                  <StatBox label="First goal before minute 30" value={pct(windows.p_first_goal_before_30)} styles={styles} />
                  {busiest ? <StatBox label="Busiest spell" value={`${busiest.window}′`} highlight styles={styles} /> : null}
                </View>
                {!windows.team_specific_signal ? (
                  <Text style={styles.note}>league average, no team-specific signal yet</Text>
                ) : null}
              </>
            ) : halves ? (
              <>
                <View style={styles.grid2}>
                  <StatBox label="Goal before half-time" value={pct(halves.p_first_half_goal)} highlight styles={styles} />
                  <StatBox
                    label="Expected goals 1st / 2nd half"
                    value={`${(halves.home.first + halves.away.first).toFixed(1)} / ${(halves.home.second + halves.away.second).toFixed(1)}`}
                    styles={styles}
                  />
                </View>
                <Text style={styles.body}>
                  {`${match.home}: ${halves.home.first.toFixed(2)} first half, ${halves.home.second.toFixed(2)} second half. ${match.away}: ${halves.away.first.toFixed(2)} first half, ${halves.away.second.toFixed(2)} second half.`}
                </Text>
              </>
            ) : (
              <Text style={styles.body}>No half-time scores are available for this league, so timing is not estimated.</Text>
            )}
            <Text style={styles.note}>{match.timing.note}</Text>
          </SectionCard>
        ) : null}

        {match.goals ? (
          <SectionCard title="How many goals?">
            <Text style={styles.body}>
              {`${match.home} ${match.goals.exp_home.toFixed(2)} expected · ${match.away} ${match.goals.exp_away.toFixed(2)} expected · ${match.goals.exp_total.toFixed(2)} total`}
            </Text>
            <View style={styles.grid3}>
              <StatBox label="2+ goals" value={pct(match.goals.over['1.5'])} styles={styles} />
              <StatBox label="3+ goals" value={pct(match.goals.over['2.5'])} styles={styles} />
              <StatBox label="4+ goals" value={pct(match.goals.over['3.5'])} styles={styles} />
            </View>
            <View style={styles.listRow}>
              <Text style={styles.listLabel}>Both teams score</Text>
              <Text style={styles.listValue}>{pct(match.goals.btts)}</Text>
            </View>
            <View style={styles.listRow}>
              <Text style={styles.listLabel}>{`${match.home} keep a clean sheet`}</Text>
              <Text style={styles.listValue}>{pct(match.goals.clean_sheet[0])}</Text>
            </View>
            <View style={styles.listRow}>
              <Text style={styles.listLabel}>{`${match.away} keep a clean sheet`}</Text>
              <Text style={styles.listValue}>{pct(match.goals.clean_sheet[1])}</Text>
            </View>
            <Text style={styles.subhead}>Most likely exact scores</Text>
            {match.goals.top_scores.map((item) => (
              <View key={item.score} style={styles.listRow}>
                <Text style={styles.listLabel}>{item.score.replace('-', '–')}</Text>
                <Text style={styles.listValue}>{pct(item.probability)}</Text>
              </View>
            ))}
          </SectionCard>
        ) : null}

        {match.homeForm && match.awayForm ? (
          <SectionCard title="Recent form" subtitle="Last 5 league games, newest on the right">
            {[
              { team: match.home, form: match.homeForm },
              { team: match.away, form: match.awayForm },
            ].map((row) => (
              <View key={row.team} style={styles.rowBetween}>
                <Text style={styles.formTeam} numberOfLines={1}>
                  {row.team}
                </Text>
                <View style={styles.formBadges}>
                  {row.form.map((res, idx) => (
                    <FormBadge key={`${row.team}-${idx}`} result={res} />
                  ))}
                </View>
              </View>
            ))}
          </SectionCard>
        ) : null}

        <SectionCard title="Compare with bookmakers">
          {refOdds && implied ? (
            <>
              <View style={styles.tableHead}>
                <Text style={[styles.tableCell, styles.tableFirst, styles.tableHeadText]} />
                <Text style={[styles.tableCell, styles.tableHeadText]}>Odds</Text>
                <Text style={[styles.tableCell, styles.tableHeadText]}>Their %</Text>
                <Text style={[styles.tableCell, styles.tableHeadText]}>Our %</Text>
              </View>
              {[match.home, 'Draw', match.away].map((label, i) => (
                <View key={label} style={styles.tableRow}>
                  <Text style={[styles.tableCell, styles.tableFirst]} numberOfLines={1}>
                    {label}
                  </Text>
                  <Text style={styles.tableCell}>{refOdds[i].toFixed(2)}</Text>
                  <Text style={styles.tableCell}>{pct(implied[i])}</Text>
                  <Text style={[styles.tableCell, styles.strong, i === pickIndex ? styles.limeText : null]}>{pct(match.p[i])}</Text>
                </View>
              ))}
              <Text style={styles.note}>{`Reference odds: ${match.reference_source ?? 'bookmaker'}.`}</Text>
            </>
          ) : (
            <Text style={styles.body}>No bookmaker odds are available for this match yet.</Text>
          )}
        </SectionCard>

        <TouchableOpacity
          style={styles.cta}
          onPress={() => setShowLogBet((prev) => !prev)}
          accessibilityRole="button"
          accessibilityState={{ expanded: showLogBet }}
          accessibilityLabel="Log a bet on this match"
        >
          <Ionicons name={showLogBet ? 'chevron-up' : 'add'} size={20} color={theme.colors.primaryTextOnColor} />
          <Text style={styles.ctaText}>{showLogBet ? 'Hide bet options' : 'Log a bet on this match'}</Text>
        </TouchableOpacity>
        {showLogBet ? (
          <SectionCard subtitle="Enter the odds you were offered, then tap + Log.">
            {outcomes.map((item) => (
              <OutcomeEdgeRow key={item.outcome} analysis={item} matchTitle={matchTitle} onLogPress={handleLogOutcome} />
            ))}
          </SectionCard>
        ) : null}

        <DisclaimerFooter />
        <Text style={styles.finePrint}>
          Statistical estimates, not certainties. Exact scores and goal minutes are hard to predict.
        </Text>
      </ScrollView>
    </ScreenContainer>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    scrollContent: { gap: theme.spacing.lg, paddingBottom: theme.spacing.xxxl },
    scoreboard: { flexDirection: 'row', alignItems: 'center' },
    teamCol: { flex: 1, alignItems: 'center', gap: theme.spacing.sm },
    teamName: { color: theme.colors.textPrimary, fontSize: 17, fontWeight: theme.typography.weights.bold, textAlign: 'center' },
    teamSide: { color: theme.colors.textMuted, fontSize: 12 },
    centerCol: { flex: 1, alignItems: 'center' },
    bigScore: { color: theme.colors.primary, fontSize: 52, lineHeight: 58, fontWeight: '900' },
    scoreCaption: { color: theme.colors.textMuted, fontSize: 12, textAlign: 'center' },
    rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: theme.spacing.sm },
    eyebrow: { color: theme.colors.textMuted, fontSize: 12, fontWeight: theme.typography.weights.bold, letterSpacing: 0.7 },
    headline: { color: theme.colors.textPrimary, fontSize: 28, lineHeight: 34, fontWeight: '900' },
    body: { color: theme.colors.textSecondary, fontSize: 15, lineHeight: 22 },
    strong: { color: theme.colors.textPrimary, fontWeight: theme.typography.weights.bold },
    limeText: { color: theme.colors.primary },
    warningText: { color: theme.colors.warningText, fontSize: 13, lineHeight: 19 },
    barRow: { gap: 6 },
    barRowTop: { flexDirection: 'row', justifyContent: 'space-between', gap: theme.spacing.sm },
    barLabel: { flexShrink: 1, color: theme.colors.textPrimary, fontSize: 15, fontWeight: theme.typography.weights.medium },
    barValue: { color: theme.colors.textPrimary, fontSize: 15, fontWeight: theme.typography.weights.bold },
    barValueHighlight: { color: theme.colors.primary },
    track: { height: 10, borderRadius: 5, backgroundColor: theme.colors.neutralBarTrack, overflow: 'hidden' },
    fill: { height: 10, borderRadius: 5, backgroundColor: theme.colors.primary },
    grid3: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm },
    grid2: { flexDirection: 'row', gap: theme.spacing.sm },
    statBox: {
      flexGrow: 1,
      flexBasis: '30%',
      gap: 2,
      padding: 10,
      borderRadius: 12,
      backgroundColor: theme.colors.surfaceElevated,
      borderWidth: theme.layout.borderWidth,
      borderColor: theme.colors.border,
    },
    statBoxHighlight: { backgroundColor: theme.colors.primaryMuted, borderColor: theme.colors.primary },
    statLabel: { color: theme.colors.textSecondary, fontSize: 12 },
    statValue: { color: theme.colors.textPrimary, fontSize: 20, fontWeight: '900' },
    statValueHighlight: { color: theme.colors.primary },
    chart: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, height: 160 },
    chartCol: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', gap: 6 },
    chartPct: { color: theme.colors.textSecondary, fontSize: 12, fontWeight: theme.typography.weights.bold },
    chartPctTop: { color: theme.colors.primary },
    chartBar: { alignSelf: 'stretch', borderTopLeftRadius: 6, borderTopRightRadius: 6, backgroundColor: theme.colors.probBarAway },
    chartBarTop: { backgroundColor: theme.colors.primary },
    chartLabel: { color: theme.colors.textSecondary, fontSize: 11 },
    note: { color: theme.colors.textMuted, fontSize: 12, lineHeight: 18 },
    subhead: { color: theme.colors.textPrimary, fontSize: 15, fontWeight: theme.typography.weights.bold, marginTop: theme.spacing.xs },
    listRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingTop: 10,
      borderTopWidth: theme.layout.borderWidth,
      borderTopColor: theme.colors.border,
    },
    listLabel: { flexShrink: 1, color: theme.colors.textPrimary, fontSize: 15 },
    listValue: { color: theme.colors.textPrimary, fontSize: 15, fontWeight: theme.typography.weights.bold },
    formTeam: { flexShrink: 1, color: theme.colors.textPrimary, fontSize: 15, fontWeight: theme.typography.weights.bold },
    formBadges: { flexDirection: 'row', gap: 6 },
    tableHead: { flexDirection: 'row', gap: theme.spacing.sm },
    tableHeadText: { color: theme.colors.textSecondary, fontSize: 12 },
    tableRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
      paddingVertical: 10,
      borderTopWidth: theme.layout.borderWidth,
      borderTopColor: theme.colors.border,
    },
    tableCell: { flex: 1, color: theme.colors.textPrimary, fontSize: 15 },
    tableFirst: { flex: 1.3, fontWeight: theme.typography.weights.medium },
    cta: {
      flexDirection: 'row',
      gap: theme.spacing.sm,
      minHeight: 52,
      borderRadius: 14,
      backgroundColor: theme.colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    ctaText: { color: theme.colors.primaryTextOnColor, fontSize: 16, fontWeight: theme.typography.weights.bold },
    finePrint: { color: theme.colors.textMuted, fontSize: 12, lineHeight: 18, textAlign: 'center' },
  });
}
