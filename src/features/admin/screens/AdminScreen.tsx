import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { AppHeader } from '@/components/AppHeader';
import { EmptyState } from '@/components/EmptyState';
import { FilterChipsRow } from '@/components/FilterChipsRow';
import { ScreenContainer } from '@/components/ScreenContainer';
import { SectionCard } from '@/components/SectionCard';
import { SegmentedControl } from '@/components/SegmentedControl';
import { fetchHistory } from '@/data/historyRepository';
import { useAppStore } from '@/data/store';
import { HistoryEntry, HistoryPayload } from '@/data/types';
import { formatShortDayAndMonth } from '@/lib/dateUtils';
import {
  HistoryFilters,
  HistoryPeriod,
  HistoryShow,
  computeHistoryStats,
  filterHistory,
  historyLeagues,
  historyPickLabel,
  resultLabel,
} from '@/lib/historyStats';
import { AppTheme, useAppTheme } from '@/theme/useAppTheme';

const PIN_LENGTH = 4;
const PAGE_SIZE = 30;
const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'] as const;

const PERIOD_OPTIONS = [
  { value: '7' as const, label: '7 days' },
  { value: '30' as const, label: '30 days' },
  { value: 'season' as const, label: 'Season' },
];
const SHOW_OPTIONS = [
  { value: 'all' as const, label: 'All' },
  { value: 'wrong' as const, label: 'Wrong only' },
  { value: 'pending' as const, label: 'Awaiting' },
];

const pct = (n: number, d: number) => (d > 0 ? `${Math.round((n / d) * 100)}%` : '–');
const dash = (score: string | null | undefined) => (score ? score.replace('-', '–') : '–');

/* ------------------------------------------------------------------ PIN gate */

interface PinPadProps {
  title: string;
  message: string;
  error: string | null;
  onComplete: (pin: string) => void;
  styles: ReturnType<typeof createStyles>;
  theme: AppTheme;
}

function PinPad({ title, message, error, onComplete, styles, theme }: PinPadProps) {
  const [digits, setDigits] = useState('');

  const press = (key: (typeof KEYS)[number]) => {
    if (key === '') return;
    if (key === 'del') {
      setDigits((d) => d.slice(0, -1));
      return;
    }
    const next = (digits + key).slice(0, PIN_LENGTH);
    setDigits(next);
    if (next.length === PIN_LENGTH) {
      setDigits('');
      onComplete(next);
    }
  };

  return (
    <View style={styles.pinWrap}>
      <View style={styles.lockIcon}>
        <Ionicons name="lock-closed-outline" size={34} color={theme.colors.primary} />
      </View>
      <View style={styles.pinText}>
        <Text style={styles.pinTitle} accessibilityRole="header">
          {title}
        </Text>
        <Text style={styles.pinMessage}>{message}</Text>
      </View>
      <View
        style={styles.dots}
        accessible
        accessibilityLabel={`PIN, ${digits.length} of ${PIN_LENGTH} digits entered`}
      >
        {Array.from({ length: PIN_LENGTH }).map((_, i) => (
          <View key={i} style={[styles.dot, i < digits.length ? styles.dotFilled : null]} />
        ))}
      </View>
      {error ? (
        <Text style={styles.pinError} accessibilityRole="alert">
          {error}
        </Text>
      ) : null}
      <View style={styles.keypad}>
        {KEYS.map((key, i) =>
          key === '' ? (
            <View key={`blank-${i}`} style={styles.keyBlank} />
          ) : (
            <TouchableOpacity
              key={key}
              style={styles.key}
              onPress={() => press(key)}
              accessibilityRole="button"
              accessibilityLabel={key === 'del' ? 'Delete digit' : `Digit ${key}`}
            >
              {key === 'del' ? (
                <Ionicons name="backspace-outline" size={24} color={theme.colors.textPrimary} />
              ) : (
                <Text style={styles.keyText}>{key}</Text>
              )}
            </TouchableOpacity>
          )
        )}
      </View>
    </View>
  );
}

/* ------------------------------------------------------------------ Dashboard */

function MatchRow({ entry, styles }: { entry: HistoryEntry; styles: ReturnType<typeof createStyles> }) {
  const done = entry.status === 'final';
  const pickedChance =
    entry.pick === 'home' ? entry.p[0] : entry.pick === 'draw' ? entry.p[1] : entry.pick === 'away' ? entry.p[2] : null;
  const chance = pickedChance === null ? '' : `${Math.round(pickedChance * 100)}%`;
  const checks = done
    ? [
        { label: 'Winner', hit: Boolean(entry.hit_winner) },
        { label: 'Margin', hit: Boolean(entry.hit_margin) },
        { label: 'Score', hit: Boolean(entry.hit_score) },
      ]
    : [];
  return (
    <View
      style={styles.rowCard}
      accessible
      accessibilityLabel={`${entry.home} vs ${entry.away}. Predicted ${historyPickLabel(entry)} ${dash(entry.score)}. ${
        done ? `Real result ${dash(entry.actual_score)}` : 'Awaiting result'
      }.`}
    >
      <View style={styles.rowMeta}>
        <Text style={styles.metaText}>{formatShortDayAndMonth(entry.date)}</Text>
        <Text style={styles.metaText}>{entry.league}</Text>
      </View>
      <Text style={styles.rowTitle}>
        {entry.home} vs {entry.away}
      </Text>
      <View style={styles.rowBoxes}>
        <View style={styles.rowBox}>
          <Text style={styles.boxLabel}>PREDICTED</Text>
          <Text style={styles.boxScoreLime}>{dash(entry.score)}</Text>
          <Text style={styles.boxText} numberOfLines={1}>
            {historyPickLabel(entry)}
            {chance ? ` · ${chance}` : ''}
          </Text>
        </View>
        <View
          style={[
            styles.rowBox,
            !done ? styles.rowBoxPending : entry.hit_winner ? styles.rowBoxRight : styles.rowBoxWrong,
          ]}
        >
          <Text style={styles.boxLabel}>REAL RESULT</Text>
          <Text style={styles.boxScore}>{done ? dash(entry.actual_score) : '–'}</Text>
          <Text style={styles.boxText} numberOfLines={1}>
            {done
              ? `${resultLabel(entry.home, entry.away, entry.actual_score)}${
                  entry.actual_ht_score ? ` · HT ${dash(entry.actual_ht_score)}` : ''
                }`
              : 'Awaiting result'}
          </Text>
        </View>
      </View>
      {done ? (
        <View style={styles.checks}>
          {checks.map((c) => (
            <View key={c.label} style={[styles.check, c.hit ? styles.checkRight : styles.checkWrong]}>
              <Text style={[styles.checkText, c.hit ? styles.checkTextRight : styles.checkTextWrong]}>
                {c.hit ? '✓' : '✕'} {c.label}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function toCsv(entries: HistoryEntry[]): string {
  const cols = [
    'date', 'league', 'home', 'away', 'pick', 'margin', 'score', 'p_home', 'p_draw', 'p_away',
    'status', 'actual_score', 'actual_ht_score', 'hit_winner', 'hit_margin', 'hit_score',
    'log_loss', 'book_favourite', 'book_correct', 'model_version', 'predicted_at',
  ];
  const cell = (v: unknown) => {
    const s = v === undefined || v === null ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const rows = entries.map((e) => {
    const extra: Record<string, unknown> = { p_home: e.p[0], p_draw: e.p[1], p_away: e.p[2] };
    return cols.map((c) => cell(c in extra ? extra[c] : (e as unknown as Record<string, unknown>)[c])).join(',');
  });
  return [cols.join(','), ...rows].join('\n');
}

function Dashboard({ styles, theme, onLock }: { styles: ReturnType<typeof createStyles>; theme: AppTheme; onLock: () => void }) {
  const [history, setHistory] = useState<HistoryPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<HistoryFilters>({ period: '30', league: 'All', show: 'all' });
  const [visible, setVisible] = useState(PAGE_SIZE);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setHistory(await fetchHistory());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The history file could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const entries = useMemo(() => history?.entries ?? [], [history]);
  const leagues = useMemo(() => ['All', ...historyLeagues(entries)], [entries]);
  const periodRows = useMemo(() => filterHistory(entries, { ...filters, show: 'all' }), [entries, filters]);
  const rows = useMemo(() => filterHistory(entries, filters), [entries, filters]);
  const stats = useMemo(() => computeHistoryStats(periodRows), [periodRows]);

  const setFilter = <K extends keyof HistoryFilters>(key: K, value: HistoryFilters[K]) => {
    setVisible(PAGE_SIZE);
    setFilters((f) => ({ ...f, [key]: value }));
  };

  if (loading && !history) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.metaText}>Loading the dataset…</Text>
      </View>
    );
  }
  if (error && !history) {
    return <EmptyState title="No dataset to show" message={error} actionLabel="Try again" onAction={() => void load()} />;
  }

  const n = stats.finished;
  const tiles = [
    { label: 'Right winner', value: stats.rightWinner, of: `of ${n}`, sub: `${pct(stats.rightWinner, n)} · random guessing gets about 33%`, lime: true },
    { label: 'Right margin', value: stats.rightMargin, of: `of ${n}`, sub: `${pct(stats.rightMargin, n)} · winner and goal gap both right` },
    { label: 'Exact score', value: stats.exactScore, of: `of ${n}`, sub: `${pct(stats.exactScore, n)} · around 10% is normal` },
    { label: 'Draws spotted', value: stats.drawsSpotted, of: `of ${stats.draws}`, sub: 'Draws are the hardest result to call', amber: true },
  ];

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
      <SegmentedControl
        options={PERIOD_OPTIONS}
        value={filters.period}
        onChange={(v: HistoryPeriod) => setFilter('period', v)}
        accessibilityLabel="Choose period"
      />
      <FilterChipsRow options={leagues} selected={filters.league} onSelect={(v) => setFilter('league', v)} />
      <Text style={styles.metaText}>
        {n} finished · {stats.pending} awaiting result
        {history?.generated_at ? ` · updated ${formatShortDayAndMonth(history.generated_at)}` : ''}
      </Text>

      <View style={styles.tiles}>
        {tiles.map((t) => (
          <View key={t.label} style={styles.tile} accessible accessibilityLabel={`${t.label}: ${t.value} ${t.of}`}>
            <Text style={styles.tileLabel}>{t.label}</Text>
            <Text style={styles.tileValueRow}>
              <Text style={[styles.tileValue, t.lime ? styles.lime : null, t.amber ? styles.amber : null]}>{t.value}</Text>
              <Text style={styles.tileOf}> {t.of}</Text>
            </Text>
            <Text style={styles.tileSub}>{t.sub}</Text>
          </View>
        ))}
      </View>

      <SectionCard
        title="Model against bookmakers"
        subtitle={stats.bookCompared ? `Right winner on the ${stats.bookCompared} matches with saved odds` : 'Needs finished matches with saved odds'}
      >
        {stats.bookCompared ? (
          <>
            {[
              { label: 'Our model', hits: stats.modelRightOnBookSet, colour: theme.colors.primary },
              { label: 'Bookmakers’ favourite', hits: stats.bookRight, colour: theme.colors.probBarDraw },
            ].map((b) => (
              <View key={b.label} style={styles.barBlock}>
                <View style={styles.rowBetween}>
                  <Text style={styles.barLabel}>{b.label}</Text>
                  <Text style={styles.barValue}>{pct(b.hits, stats.bookCompared)} · {b.hits}</Text>
                </View>
                <View style={styles.track}>
                  <View style={[styles.fill, { backgroundColor: b.colour, width: `${(b.hits / stats.bookCompared) * 100}%` }]} />
                </View>
              </View>
            ))}
            {stats.modelLogLoss !== null && stats.bookLogLoss !== null ? (
              <View style={[styles.rowBetween, styles.divider]}>
                <Text style={styles.metaText}>Log loss (lower is better)</Text>
                <Text style={styles.barValue}>
                  {stats.modelLogLoss.toFixed(3)} vs {stats.bookLogLoss.toFixed(3)}
                </Text>
              </View>
            ) : null}
            <Text style={styles.metaText}>Wait for a few hundred matches before drawing conclusions.</Text>
          </>
        ) : null}
      </SectionCard>

      <SectionCard
        title="Are our chances honest?"
        subtitle="When we gave a result this chance, how often did it happen? White line = what we said, bar = what happened."
      >
        {stats.calibration.length === 0 ? (
          <Text style={styles.metaText}>Appears once matches have finished.</Text>
        ) : (
          stats.calibration.map((b) => (
            <View key={b.label} style={styles.calibRow} accessible accessibilityLabel={`We said ${Math.round(b.said * 100)}%, it happened ${Math.round(b.happened * 100)}%, ${b.count} chances`}>
              <Text style={styles.calibLabel}>{b.label}</Text>
              <View style={styles.calibTrack}>
                <View style={[styles.calibFill, { width: `${b.happened * 100}%` }]} />
                <View style={[styles.calibMark, { left: `${b.said * 100}%` }]} />
                <Text style={styles.calibNum}>{Math.round(b.happened * 100)}%</Text>
              </View>
              <Text style={styles.calibCount}>{b.count}</Text>
            </View>
          ))
        )}
      </SectionCard>

      <Text style={styles.sectionTitle} accessibilityRole="header">
        Match by match
      </Text>
      <SegmentedControl
        options={SHOW_OPTIONS}
        value={filters.show}
        onChange={(v: HistoryShow) => setFilter('show', v)}
        accessibilityLabel="Choose which matches to show"
      />
      {rows.length === 0 ? <Text style={styles.metaText}>No matches for these filters.</Text> : null}
      {rows.slice(0, visible).map((entry) => (
        <MatchRow key={entry.id} entry={entry} styles={styles} />
      ))}
      {rows.length > visible ? (
        <TouchableOpacity
          style={styles.ghostButton}
          onPress={() => setVisible((v) => v + PAGE_SIZE)}
          accessibilityRole="button"
          accessibilityLabel="Show more matches"
        >
          <Text style={styles.ghostText}>Show more ({rows.length - visible} left)</Text>
        </TouchableOpacity>
      ) : null}

      <TouchableOpacity
        style={styles.ghostButton}
        onPress={() => void Share.share({ message: toCsv(rows), title: 'MatchSense predictions vs results' })}
        accessibilityRole="button"
        accessibilityLabel="Share these matches as CSV"
      >
        <Ionicons name="share-outline" size={18} color={theme.colors.textPrimary} />
        <Text style={styles.ghostText}>Share dataset (CSV)</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.linkButton} onPress={onLock} accessibilityRole="button" accessibilityLabel="Lock admin">
        <Text style={styles.linkText}>Lock admin</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

/* ------------------------------------------------------------------ Screen */

export function AdminScreen() {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const adminPin = useAppStore((s) => s.adminPin);
  const setAdminPin = useAppStore((s) => s.setAdminPin);
  const [unlocked, setUnlocked] = useState(false);
  const [firstPin, setFirstPin] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handlePin = (pin: string) => {
    if (adminPin) {
      if (pin === adminPin) {
        setError(null);
        setUnlocked(true);
      } else {
        setError('Wrong PIN. Try again.');
      }
      return;
    }
    if (!firstPin) {
      setFirstPin(pin);
      setError(null);
      return;
    }
    if (pin === firstPin) {
      setAdminPin(pin);
      setFirstPin(null);
      setError(null);
      setUnlocked(true);
    } else {
      setFirstPin(null);
      setError('The two PINs did not match. Start again.');
    }
  };

  const creating = !adminPin;
  return (
    <ScreenContainer>
      <AppHeader
        title="Model check"
        subtitle="Predicted against real results"
        showBack
        right={
          <View style={styles.adminPill}>
            <Ionicons name="lock-closed" size={12} color={theme.colors.warningText} />
            <Text style={styles.adminPillText}>Admin</Text>
          </View>
        }
      />
      {unlocked ? (
        <Dashboard styles={styles} theme={theme} onLock={() => setUnlocked(false)} />
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <PinPad
            title={creating ? (firstPin ? 'Repeat your new PIN' : 'Create an admin PIN') : 'Admin access'}
            message={
              creating
                ? 'Choose 4 digits. You will need them to open this screen next time.'
                : 'Enter your 4-digit PIN to see how the predictions compare with real results.'
            }
            error={error}
            onComplete={handlePin}
            styles={styles}
            theme={theme}
          />
          <Text style={styles.finePrint}>
            The PIN keeps casual users out. It is stored on this phone and is not real security.
          </Text>
        </ScrollView>
      )}
    </ScreenContainer>
  );
}

function createStyles(theme: AppTheme) {
  const c = theme.colors;
  return StyleSheet.create({
    scrollContent: { gap: theme.spacing.lg, paddingBottom: theme.spacing.xxxl },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: theme.spacing.md },
    adminPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: theme.radii.pill,
      backgroundColor: c.surfaceWarningBanner,
    },
    adminPillText: { color: c.warningText, fontSize: 12, fontWeight: theme.typography.weights.bold },
    // PIN
    pinWrap: { alignItems: 'center', gap: 24, paddingTop: theme.spacing.xl },
    lockIcon: { width: 72, height: 72, borderRadius: 22, backgroundColor: c.primaryMuted, alignItems: 'center', justifyContent: 'center' },
    pinText: { alignItems: 'center', gap: 6, paddingHorizontal: theme.spacing.lg },
    pinTitle: { color: c.textPrimary, fontSize: 24, fontWeight: '900', textAlign: 'center' },
    pinMessage: { color: c.textSecondary, fontSize: 14, lineHeight: 20, textAlign: 'center' },
    dots: { flexDirection: 'row', gap: 18 },
    dot: { width: 16, height: 16, borderRadius: 8, borderWidth: 2, borderColor: c.borderAccent },
    dotFilled: { backgroundColor: c.primary, borderColor: c.primary },
    pinError: { color: c.dangerText, fontSize: 14, fontWeight: theme.typography.weights.bold },
    keypad: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 14, maxWidth: 320 },
    key: {
      width: 92,
      height: 64,
      borderRadius: 18,
      backgroundColor: c.surface,
      borderWidth: theme.layout.borderWidth,
      borderColor: c.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    keyBlank: { width: 92, height: 64 },
    keyText: { color: c.textPrimary, fontSize: 26, fontWeight: theme.typography.weights.bold },
    finePrint: { color: c.textMuted, fontSize: 12, lineHeight: 18, textAlign: 'center' },
    // Dashboard
    metaText: { color: c.textSecondary, fontSize: 13, lineHeight: 19 },
    tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    tile: {
      flexGrow: 1,
      flexBasis: '45%',
      gap: 6,
      padding: theme.spacing.lg,
      borderRadius: 18,
      backgroundColor: c.surface,
      borderWidth: theme.layout.borderWidth,
      borderColor: c.border,
    },
    tileLabel: { color: c.textSecondary, fontSize: 13 },
    tileValueRow: {},
    tileValue: { color: c.textPrimary, fontSize: 28, fontWeight: '900' },
    tileOf: { color: c.textSecondary, fontSize: 13 },
    tileSub: { color: c.textMuted, fontSize: 12, lineHeight: 17 },
    lime: { color: c.primary },
    amber: { color: c.warningText },
    rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: theme.spacing.sm },
    divider: { paddingTop: theme.spacing.md, borderTopWidth: theme.layout.borderWidth, borderTopColor: c.border },
    barBlock: { gap: 6 },
    barLabel: { color: c.textPrimary, fontSize: 14 },
    barValue: { color: c.textPrimary, fontSize: 14, fontWeight: theme.typography.weights.bold },
    track: { height: 12, borderRadius: 6, backgroundColor: c.neutralBarTrack, overflow: 'hidden' },
    fill: { height: 12, borderRadius: 6 },
    calibRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
    calibLabel: { width: 64, color: c.textPrimary, fontSize: 14, fontWeight: theme.typography.weights.bold },
    calibTrack: { flex: 1, height: 24, borderRadius: 6, backgroundColor: c.neutralBarTrack, overflow: 'hidden', justifyContent: 'center' },
    calibFill: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 6, backgroundColor: c.probBarDraw },
    calibMark: { position: 'absolute', top: 0, bottom: 0, width: 2, backgroundColor: c.textPrimary },
    calibNum: { marginLeft: 8, color: c.primaryTextOnColor, fontSize: 12, fontWeight: theme.typography.weights.bold },
    calibCount: { width: 40, textAlign: 'right', color: c.textSecondary, fontSize: 13 },
    sectionTitle: { color: c.textPrimary, fontSize: 18, fontWeight: theme.typography.weights.bold },
    rowCard: {
      gap: 10,
      padding: 14,
      borderRadius: 16,
      backgroundColor: c.surface,
      borderWidth: theme.layout.borderWidth,
      borderColor: c.border,
    },
    rowMeta: { flexDirection: 'row', justifyContent: 'space-between' },
    rowTitle: { color: c.textPrimary, fontSize: 16, fontWeight: theme.typography.weights.bold },
    rowBoxes: { flexDirection: 'row', gap: theme.spacing.sm },
    rowBox: { flex: 1, padding: 10, borderRadius: 12, backgroundColor: c.surfaceElevated },
    rowBoxRight: { backgroundColor: c.winSurface },
    rowBoxWrong: { backgroundColor: c.surfaceDangerBanner },
    rowBoxPending: { backgroundColor: 'transparent', borderWidth: 1, borderStyle: 'dashed', borderColor: c.borderAccent },
    boxLabel: { color: c.textMuted, fontSize: 11, fontWeight: theme.typography.weights.bold, letterSpacing: 0.6 },
    boxScore: { color: c.textPrimary, fontSize: 20, fontWeight: '900' },
    boxScoreLime: { color: c.primary, fontSize: 20, fontWeight: '900' },
    boxText: { color: c.textSecondary, fontSize: 12 },
    checks: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    check: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: theme.radii.pill },
    checkRight: { backgroundColor: c.winSurface },
    checkWrong: { backgroundColor: c.surfaceDangerBanner },
    checkText: { fontSize: 12, fontWeight: theme.typography.weights.bold },
    checkTextRight: { color: c.formWin },
    checkTextWrong: { color: c.dangerText },
    ghostButton: {
      flexDirection: 'row',
      gap: theme.spacing.sm,
      minHeight: 48,
      borderRadius: 14,
      borderWidth: theme.layout.borderWidth,
      borderColor: c.borderAccent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    ghostText: { color: c.textPrimary, fontSize: 15, fontWeight: theme.typography.weights.bold },
    linkButton: { minHeight: theme.layout.minTouchTarget, alignItems: 'center', justifyContent: 'center' },
    linkText: { color: c.textSecondary, fontSize: 14, textDecorationLine: 'underline' },
  });
}
