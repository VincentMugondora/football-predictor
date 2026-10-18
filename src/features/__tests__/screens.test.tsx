import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import React from 'react';

import { useAppStore } from '@/data/store';
import { BetLogScreen } from '@/features/betLog/screens/BetLogScreen';
import { PicksScreen } from '@/features/picks/screens/PicksScreen';
import { SummaryScreen } from '@/features/summary/screens/SummaryScreen';

jest.mock('expo-router', () => ({
  router: {
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    canGoBack: jest.fn(() => true),
  },
  useLocalSearchParams: jest.fn(() => ({ id: 'ars-liv-2026-10-24' })),
}));

jest.mock('react-native-safe-area-context', () => {
  const ReactActual = require('react');
  const { View } = require('react-native');
  return {
    SafeAreaView: ({ children, style }: { children: React.ReactNode; style?: object }) =>
      ReactActual.createElement(View, { style }, children),
  };
});

describe('Tab Screen Render Tests', () => {
  beforeEach(() => {
    useAppStore.getState().resetStoreToDefaults();
  });

  it('renders PicksScreen with backtest verdict banner, featured match, and compliance footer', async () => {
    render(<PicksScreen />);

    await waitFor(() => {
      expect(
        screen.getByText('Model beats closing market log-loss over 420 matches')
      ).toBeTruthy();
    });

    expect(screen.getAllByText('Arsenal').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Liverpool').length).toBeGreaterThan(0);
    expect(
      screen.getByText('Estimates, not advice. Only bet money you can afford to lose.')
    ).toBeTruthy();
  });

  it('renders BetLogScreen, validates bet form inputs, and warns when stake exceeds maxStakePct', () => {
    render(<BetLogScreen />);

    expect(
      screen.getByText('Illustrative sample results — not verified performance')
    ).toBeTruthy();

    const addBtn = screen.getByLabelText('Open form to log a new bet');
    fireEvent.press(addBtn);

    const matchInput = screen.getByLabelText('Match teams');
    const oddsInput = screen.getByLabelText('Decimal odds');
    const stakeInput = screen.getByLabelText('Bet stake');

    // Trigger invalid odds (<= 1)
    fireEvent.changeText(matchInput, 'Arsenal vs Liverpool');
    fireEvent.changeText(oddsInput, '0.95');
    fireEvent.press(screen.getByLabelText('Save bet'));

    expect(screen.getByText('Decimal odds must be greater than 1.00.')).toBeTruthy();

    // Fix odds, enter stake above 5% maxStakePct (e.g. $12 on ~$101.67 bankroll)
    fireEvent.changeText(oddsInput, '2.40');
    fireEvent.changeText(stakeInput, '12');
    fireEvent.press(screen.getByLabelText('Save bet'));

    expect(
      screen.getByLabelText('Confirm stake above max percent and save bet')
    ).toBeTruthy();
  });

  it('renders SummaryScreen with bankroll, ROI, <100 settled bets notice, and triggers drawdown alert when threshold passed', () => {
    render(<SummaryScreen />);

    expect(
      screen.getByText('Fewer than 100 settled bets is mostly luck')
    ).toBeTruthy();
    expect(screen.getByText('Current Bankroll')).toBeTruthy();
    expect(screen.getByText('Win rate vs break-even rate')).toBeTruthy();

    // Add a large losing bet to exceed the 20% drawdown alert level
    useAppStore.getState().addBet({
      match: 'Test Drawdown Match',
      pick: 'Home',
      odds: 2.0,
      stake: 30,
      tag: 'Test',
      result: 'Loss',
    });

    render(<SummaryScreen />);
    expect(screen.getByText(/Stop and review: Drawdown/)).toBeTruthy();
  });
});
