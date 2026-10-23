import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { View } from 'react-native';

import { useAppStore } from '@/data/store';
import { PicksLoadError, picksRepository } from '@/data/picksRepository';
import { MatchPick, MinuteWindowPrediction, PicksPayload } from '@/data/types';
import { BetLogScreen } from '@/features/betLog/screens/BetLogScreen';
import { FavouritesScreen } from '@/features/picks/screens/FavouritesScreen';
import { MatchDetailScreen } from '@/features/picks/screens/MatchDetailScreen';
import { PicksScreen } from '@/features/picks/screens/PicksScreen';
import { PredictionsScreen } from '@/features/picks/screens/PredictionsScreen';
import { SummaryScreen } from '@/features/summary/screens/SummaryScreen';

const recordedPicks = JSON.parse(
  readFileSync(join(__dirname, 'fixtures', 'picks-v2.live.json'), 'utf8')
) as PicksPayload;
const recordedMatch = recordedPicks.matches[0] as MatchPick;
const mockedRouterHooks = jest.requireMock('expo-router') as {
  useLocalSearchParams: jest.Mock;
};

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(async () => null),
    setItem: jest.fn(async () => undefined),
    removeItem: jest.fn(async () => undefined),
  },
}));

jest.mock('expo-router', () => ({
  router: {
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    canGoBack: jest.fn(() => true),
  },
  useLocalSearchParams: jest.fn(() => ({ id: 'newcas-everto-2025-05-25' })),
}));

const MockSafeAreaView = View;
const MockIcon = View;

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children, style }: { children: React.ReactNode; style?: object }) => (
    <MockSafeAreaView style={style}>{children}</MockSafeAreaView>
  ),
}));

jest.mock('@expo/vector-icons', () => ({
  Ionicons: () => <MockIcon />,
}));

describe('Tab Screen Render Tests', () => {
  beforeEach(() => {
    useAppStore.getState().resetStoreToDefaults();
    jest.spyOn(picksRepository, 'getPicks').mockResolvedValue(recordedPicks);
    jest.spyOn(picksRepository, 'getMatchById').mockImplementation(
      (id) => recordedPicks.matches.find((match) => match.id === id)
    );
    mockedRouterHooks.useLocalSearchParams.mockReturnValue({ id: recordedMatch.id });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders PicksScreen with backtest verdict banner, featured match, and compliance footer', async () => {
    await render(<PicksScreen />);
    const listMatch = recordedPicks.matches.find((match) => !match.featured) ?? recordedMatch;

    expect(screen.getByText(recordedPicks.backtest.verdict)).toBeTruthy();

    expect(screen.getAllByText(listMatch.home).length).toBeGreaterThan(0);
    expect(screen.getAllByText(listMatch.away).length).toBeGreaterThan(0);
    expect(
      screen.getByText('Estimates, not advice. Only bet money you can afford to lose.')
    ).toBeTruthy();
  });

  it('shows the repository’s specific plain-language error on the Picks screen', async () => {
    const message = 'The picks server returned HTTP 503. Try again later or contact the publisher.';
    jest.spyOn(picksRepository, 'getPicks').mockRejectedValueOnce(
      new PicksLoadError('http_status', message, 'https://example.test/picks.json', undefined, 503)
    );

    await render(<PicksScreen />);

    expect(await screen.findByText(message)).toBeTruthy();
  });

  it('renders PredictionsScreen with backtest verdict banner and real match probability bars', async () => {
    await render(<PredictionsScreen />);
    const homePercent = `${Math.round(recordedMatch.p[0] * 100)}%`;
    const drawPercent = `${Math.round(recordedMatch.p[1] * 100)}%`;

    expect(screen.getByText(recordedPicks.backtest.verdict)).toBeTruthy();
    expect(screen.getAllByText(homePercent).length).toBeGreaterThan(0);
    expect(screen.getAllByText(drawPercent).length).toBeGreaterThan(0);
  });

  it('renders FavouritesScreen with YOUR FAVOURITE TEAMS and ADD TEAMS sections and toggles favourite state', async () => {
    await render(<FavouritesScreen />);

    expect(screen.getByText('YOUR FAVOURITE TEAMS')).toBeTruthy();
    expect(screen.getByText('ADD TEAMS')).toBeTruthy();
    expect(screen.getByText('Arsenal')).toBeTruthy();
    expect(screen.getByText('Liverpool')).toBeTruthy();

    const addLivBtn = screen.getByLabelText('Add Liverpool to favourite teams');
    await fireEvent.press(addLivBtn);

    expect(useAppStore.getState().favouriteTeams).toContain('Liverpool');
  });

  it('renders goals, winner, and halftime timing from the recorded live picks.json sample', async () => {
    await render(<MatchDetailScreen />);

    expect(screen.getByText(`${recordedMatch.home} vs ${recordedMatch.away}`)).toBeTruthy();
    expect(screen.getByText('MATCH OUTCOME PROBABILITIES')).toBeTruthy();
    expect(screen.getByText('GOALS AND SCORELINES')).toBeTruthy();
    expect(screen.getByText('GOAL TIMING')).toBeTruthy();
    expect(screen.getByText(/Statistical estimates, not certainties\. Exact scores and goal minutes are hard to predict\./)).toBeTruthy();
    expect(screen.getByText(new RegExp(`${recordedMatch.home} ${recordedMatch.goals?.exp_home.toFixed(2)} expected`))).toBeTruthy();
    expect(screen.getByText(recordedMatch.timing?.note ?? '')).toBeTruthy();
  });

  it('renders league-average minute windows without implying team-specific timing', async () => {
    const labels = ['0-15', '16-30', '31-45+', '46-60', '61-75', '76-90+'] as const;
    const sideWindows = Object.fromEntries(labels.map((label) => [label, {
      expected_goals: 0.1,
      p_at_least_one: 0.095,
    }])) as MinuteWindowPrediction['home'];
    const windowMatch: MatchPick = {
      ...recordedMatch,
      id: 'minute-window-test',
      timing: {
        level: 'minute',
        halves: null,
        windows: {
          home: sideWindows,
          away: sideWindows,
          p_first_goal_before_30: 0.32,
          team_specific_signal: false,
          league_goal_sample: 12,
        },
        note: 'league average, no team-specific signal yet; no exact-minute prediction.',
      },
    };
    jest.spyOn(picksRepository, 'getMatchById').mockReturnValue(windowMatch);
    mockedRouterHooks.useLocalSearchParams.mockReturnValue({ id: windowMatch.id });

    await render(<MatchDetailScreen />);

    expect(screen.getByText('15-minute windows')).toBeTruthy();
    expect(screen.getByText('league average, no team-specific signal yet')).toBeTruthy();
    expect(screen.getByText('First goal before minute 30')).toBeTruthy();
    expect(screen.getByText(/0-15 minutes/)).toBeTruthy();
  });

  it('renders BetLogScreen, keeps unmatched bets pending, and validates the My Bets form', async () => {
    // The recorded live picks file contains no reconciliation for this pending bet.
    useAppStore.getState().addBet({
      match: 'Chelsea vs Man Utd',
      pick: 'Home',
      odds: 1.56,
      stake: 5,
      tag: 'EPL',
      result: 'Pending',
    });

    await render(<BetLogScreen />);

    // 1. Default tab shows Post-Match Verification (Predicted vs Actual)
    expect(screen.getByText(/Post-Match Verification/)).toBeTruthy();
    expect(screen.getByText(/Completed match comparisons/)).toBeTruthy();

    // Without a matching verified result, the app must not invent a settlement.
    const settledBet = useAppStore.getState().bets[0];
    expect(settledBet?.result).toBe('Pending');
    expect(settledBet?.scoreline).toBeUndefined();

    // 3. Switch to My Bets tab and validate form inputs
    const myBetsTab = screen.getByLabelText('Show your logged bets and bankroll tracker');
    await fireEvent.press(myBetsTab);

    expect(
      screen.getByText('Offline Bet Tracker — Auto-settled from real results')
    ).toBeTruthy();

    const addBtn = screen.getByLabelText('Open form to log a new bet');
    await fireEvent.press(addBtn);

    const matchInput = screen.getByLabelText('Match teams');
    const oddsInput = screen.getByLabelText('Decimal odds');
    const stakeInput = screen.getByLabelText('Bet stake');

    // Trigger invalid odds (<= 1)
    await fireEvent.changeText(matchInput, 'Man Utd vs Aston Villa');
    await fireEvent.changeText(oddsInput, '0.95');
    await fireEvent.press(screen.getByLabelText('Save bet'));

    expect(screen.getByText('Decimal odds must be greater than 1.00.')).toBeTruthy();

    // Fix odds, enter stake above 5% maxStakePct (e.g. $12 on $104.25 bankroll)
    await fireEvent.changeText(oddsInput, '2.40');
    await fireEvent.changeText(stakeInput, '12');
    await fireEvent.press(screen.getByLabelText('Save bet'));

    expect(
      screen.getByLabelText('Confirm stake above max percent and save bet')
    ).toBeTruthy();
  });

  it('renders SummaryScreen with bankroll, ROI, <100 settled bets notice, and triggers drawdown alert when threshold passed', async () => {
    await render(<SummaryScreen />);

    expect(screen.getByText('Fewer than 100 settled bets is mostly luck')).toBeTruthy();
    expect(screen.getByText('Current Bankroll')).toBeTruthy();
    expect(screen.getByText('Win rate vs break-even rate')).toBeTruthy();

    // Add a large losing bet to exceed the 20% drawdown alert level
    await act(async () => {
      useAppStore.getState().addBet({
        match: 'Test Drawdown Match',
        pick: 'Home',
        odds: 2.0,
        stake: 30,
        tag: 'Test',
        result: 'Loss',
      });
    });

    expect(screen.getByText(/Stop and review: Drawdown/)).toBeTruthy();
  });
});
