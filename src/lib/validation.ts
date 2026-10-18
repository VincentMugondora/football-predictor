import { OutcomeKey } from '@/data/types';

export interface BetFormInput {
  match: string;
  pick: OutcomeKey;
  oddsInput: string;
  stakeInput: string;
  tag: string;
}

export interface BetFormValidationResult {
  isValid: boolean;
  errors: {
    match?: string;
    odds?: string;
    stake?: string;
  };
  parsedOdds: number;
  parsedStake: number;
  exceedsMaxStakePct: boolean;
  stakePctOfBankroll: number;
}

/**
 * Pure validation for logging a bet.
 * Enforces: non-empty match name, odds > 1, stake > 0, stake <= currentBankroll.
 * Flags a non-blocking warning when stake > (maxStakePct / 100) * currentBankroll.
 */
export function validateBetForm(
  input: BetFormInput,
  currentBankroll: number,
  maxStakePct: number
): BetFormValidationResult {
  const errors: BetFormValidationResult['errors'] = {};
  const trimmedMatch = input.match.trim();

  if (trimmedMatch.length === 0) {
    errors.match = 'Enter the match teams (e.g. Arsenal vs Liverpool).';
  }

  const parsedOdds = Number(input.oddsInput.trim());
  if (!Number.isFinite(parsedOdds) || parsedOdds <= 1) {
    errors.odds = 'Decimal odds must be greater than 1.00.';
  }

  const parsedStake = Number(input.stakeInput.trim());
  if (!Number.isFinite(parsedStake) || parsedStake <= 0) {
    errors.stake = 'Stake must be greater than 0.';
  } else if (parsedStake > currentBankroll) {
    errors.stake = `Stake cannot exceed your current bankroll ($${currentBankroll.toFixed(2)}).`;
  }

  const stakePctOfBankroll =
    currentBankroll > 0 && Number.isFinite(parsedStake) && parsedStake > 0
      ? (parsedStake / currentBankroll) * 100
      : 0;

  const exceedsMaxStakePct =
    Object.keys(errors).length === 0 && maxStakePct > 0 && stakePctOfBankroll > maxStakePct;

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
    parsedOdds: Number.isFinite(parsedOdds) ? parsedOdds : 0,
    parsedStake: Number.isFinite(parsedStake) ? parsedStake : 0,
    exceedsMaxStakePct,
    stakePctOfBankroll,
  };
}
