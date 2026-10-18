import { describe, expect, it } from '@jest/globals';

import { validateBetForm } from '@/lib/validation';

describe('validateBetForm', () => {
  it('passes valid input below maxStakePct without warning', () => {
    const res = validateBetForm(
      {
        match: 'Arsenal vs Liverpool',
        pick: 'Home',
        oddsInput: '2.40',
        stakeInput: '3.00',
        tag: 'Premier League',
      },
      100,
      5
    );

    expect(res.isValid).toBe(true);
    expect(res.exceedsMaxStakePct).toBe(false);
    expect(res.errors).toEqual({});
  });

  it('rejects odds <= 1', () => {
    const res = validateBetForm(
      {
        match: 'Arsenal vs Liverpool',
        pick: 'Home',
        oddsInput: '1.00',
        stakeInput: '2.00',
        tag: 'Premier League',
      },
      100,
      5
    );

    expect(res.isValid).toBe(false);
    expect(res.errors.odds).toBeDefined();
  });

  it('rejects stake <= 0 and stake > bankroll', () => {
    const zeroStake = validateBetForm(
      {
        match: 'Arsenal vs Liverpool',
        pick: 'Home',
        oddsInput: '2.10',
        stakeInput: '0',
        tag: 'Premier League',
      },
      100,
      5
    );
    expect(zeroStake.isValid).toBe(false);
    expect(zeroStake.errors.stake).toContain('greater than 0');

    const overBankroll = validateBetForm(
      {
        match: 'Arsenal vs Liverpool',
        pick: 'Home',
        oddsInput: '2.10',
        stakeInput: '125',
        tag: 'Premier League',
      },
      100,
      5
    );
    expect(overBankroll.isValid).toBe(false);
    expect(overBankroll.errors.stake).toContain('cannot exceed your current bankroll');
  });

  it('flags exceedsMaxStakePct when stake is valid but above user maxStakePct', () => {
    const res = validateBetForm(
      {
        match: 'Chelsea vs Tottenham',
        pick: 'Home',
        oddsInput: '2.20',
        stakeInput: '8.00', // 8% of $100 bankroll > 5% maxStakePct
        tag: 'Premier League',
      },
      100,
      5
    );

    expect(res.isValid).toBe(true);
    expect(res.exceedsMaxStakePct).toBe(true);
    expect(res.stakePctOfBankroll).toBeCloseTo(8, 2);
  });
});
