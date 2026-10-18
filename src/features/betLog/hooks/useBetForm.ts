import { useCallback, useMemo, useState } from 'react';

import { useAppStore } from '@/data/store';
import { OutcomeKey } from '@/data/types';
import { calculateDrawdownFromPeak } from '@/lib/calculations';
import { validateBetForm } from '@/lib/validation';

export function useBetForm() {
  const bets = useAppStore((s) => s.bets);
  const settings = useAppStore((s) => s.settings);
  const draftBet = useAppStore((s) => s.draftBet);
  const addBet = useAppStore((s) => s.addBet);
  const setDraftBet = useAppStore((s) => s.setDraftBet);

  const currentBankroll = useMemo(() => {
    const dd = calculateDrawdownFromPeak(settings.startingBankroll, bets);
    return dd.currentBankroll;
  }, [settings.startingBankroll, bets]);

  const defaultStakeStr = useMemo(() => {
    const raw = currentBankroll * (settings.usualStakePct / 100);
    const clamped = Math.max(0.5, Number(raw.toFixed(2)));
    return String(clamped);
  }, [currentBankroll, settings.usualStakePct]);

  const [isFormOpen, setIsFormOpen] = useState<boolean>(false);
  const [match, setMatch] = useState<string>('');
  const [pick, setPick] = useState<OutcomeKey>('Home');
  const [oddsInput, setOddsInput] = useState<string>('2.00');
  const [stakeInput, setStakeInput] = useState<string>(defaultStakeStr);
  const [tag, setTag] = useState<string>('Premier League');
  const [hasSubmittedAttempt, setHasSubmittedAttempt] = useState<boolean>(false);
  const [awaitingMaxStakeConfirm, setAwaitingMaxStakeConfirm] = useState<boolean>(false);
  const [appliedDraftRef, setAppliedDraftRef] = useState<typeof draftBet>(null);

  // Synchronize draftBet prefill during render without cascading an effect
  if (draftBet && draftBet !== appliedDraftRef) {
    setAppliedDraftRef(draftBet);
    setMatch(draftBet.match);
    setPick(draftBet.pick);
    setOddsInput(draftBet.odds.toFixed(2));
    setStakeInput(defaultStakeStr);
    setTag(draftBet.tag);
    setHasSubmittedAttempt(false);
    setAwaitingMaxStakeConfirm(false);
    setIsFormOpen(true);
  }

  const validation = useMemo(
    () =>
      validateBetForm(
        {
          match,
          pick,
          oddsInput,
          stakeInput,
          tag,
        },
        currentBankroll,
        settings.maxStakePct
      ),
    [match, pick, oddsInput, stakeInput, tag, currentBankroll, settings.maxStakePct]
  );

  const openBlankForm = useCallback(() => {
    setMatch('');
    setPick('Home');
    setOddsInput('2.00');
    setStakeInput(defaultStakeStr);
    setTag('Premier League');
    setHasSubmittedAttempt(false);
    setAwaitingMaxStakeConfirm(false);
    setIsFormOpen(true);
  }, [defaultStakeStr]);

  const closeForm = useCallback(() => {
    setIsFormOpen(false);
    setHasSubmittedAttempt(false);
    setAwaitingMaxStakeConfirm(false);
    setAppliedDraftRef(null);
    setDraftBet(null);
  }, [setDraftBet]);

  const submitBet = useCallback(
    (forceConfirmMaxStake = false): boolean => {
      setHasSubmittedAttempt(true);
      if (!validation.isValid) {
        return false;
      }

      if (
        validation.exceedsMaxStakePct &&
        !forceConfirmMaxStake &&
        !awaitingMaxStakeConfirm
      ) {
        setAwaitingMaxStakeConfirm(true);
        return false;
      }

      addBet({
        match: match.trim(),
        pick,
        odds: validation.parsedOdds,
        stake: validation.parsedStake,
        tag: tag.trim() || 'General',
        result: 'Pending',
      });

      setIsFormOpen(false);
      setHasSubmittedAttempt(false);
      setAwaitingMaxStakeConfirm(false);
      setAppliedDraftRef(null);
      return true;
    },
    [validation, awaitingMaxStakeConfirm, addBet, match, pick, tag]
  );

  return {
    isFormOpen,
    openBlankForm,
    closeForm,
    match,
    setMatch,
    pick,
    setPick: (nextPick: OutcomeKey) => {
      setPick(nextPick);
      setAwaitingMaxStakeConfirm(false);
    },
    oddsInput,
    setOddsInput: (val: string) => {
      setOddsInput(val);
      setAwaitingMaxStakeConfirm(false);
    },
    stakeInput,
    setStakeInput: (val: string) => {
      setStakeInput(val);
      setAwaitingMaxStakeConfirm(false);
    },
    tag,
    setTag,
    currentBankroll,
    maxStakePct: settings.maxStakePct,
    validation,
    hasSubmittedAttempt,
    awaitingMaxStakeConfirm,
    submitBet,
  };
}
