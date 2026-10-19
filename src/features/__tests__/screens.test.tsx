import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
import { View } from 'react-native';

import { useAppStore } from '@/data/store';
import { BetLogScreen } from '@/features/betLog/screens/BetLogScreen';
import { FavouritesScreen } from '@/features/picks/screens/FavouritesScreen';
import { MatchDetailScreen } from '@/features/picks/screens/MatchDetailScreen';
import { PicksScreen } from '@/features/picks/screens/PicksScreen';
import { PredictionsScreen } from '@/features/picks/screens/PredictionsScreen';
import { SummaryScreen } from '@/features/summary/screens/SummaryScreen';

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
  useLocalSearchParams: jest.fn(() => ({ id: 'man-ut-aston--2025-05-25' })),
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
  });

  it('renders PicksScreen with backtest verdict banner, featured match, and compliance footer', async () => {
    await render(<PicksScreen />);

    expect(screen.getByText('No proven edge: treat these as estimates.')).toBeTruthy();

    expect(screen.getAllByText('Man Utd').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Aston Villa').length).toBeGreaterThan(0);
    expect(
      screen.getByText('Estimates, not advice. Only bet money you can afford to lose.')
    ).toBeTruthy();
  });

  it('renders PredictionsScreen with backtest verdict banner and real match probability bars', async () => {
    await render(<PredictionsScreen />);

    expect(screen.getByText('No proven edge: treat these as estimates.')).toBeTruthy();
    expect(screen.getAllByText('33%').length).toBeGreaterThan(0);
    expect(screen.getAllByText('63%').length).toBeGreaterThan(0);
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

  it('renders MatchDetailScreen with RECENT FORM, MATCH OUTCOME PROBABILITIES, KEY STATS, and OUR TAKE', async () => {
    await render(<MatchDetailScreen />);

    expect(screen.getByText('Man Utd vs Aston Villa')).toBeTruthy();
    expect(screen.getByText('RECENT FORM')).toBeTruthy();
    expect(screen.getByText('MATCH OUTCOME PROBABILITIES')).toBeTruthy();
    expect(screen.getByText('KEY STATS (PER GAME)')).toBeTruthy();
    expect(screen.getByText('OUR TAKE')).toBeTruthy();
    expect(
      screen.getByText(
        'Balanced fixture (Man Utd 33%, Draw 27%, Aston Villa 40%) based on multi-season Poisson ratings.'
      )
    ).toBeTruthy();
  });

  it('renders BetLogScreen, validates bet form inputs, and warns when stake exceeds maxStakePct', async () => {
    await render(<BetLogScreen />);

    expect(screen.getByText('Offline Bet Tracker — Local device storage')).toBeTruthy();

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

    // Fix odds, enter stake above 5% maxStakePct (e.g. $12 on $100.00 bankroll)
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
