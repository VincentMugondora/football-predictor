import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist, StateStorage } from 'zustand/middleware';

import { INITIAL_SAMPLE_BETS } from '@/data/mockPicks';
import {
  BetDraft,
  BetRecord,
  BetResult,
  MatchResultComparison,
  UserSettings,
} from '@/data/types';

export const DEFAULT_USER_SETTINGS: UserSettings = {
  startingBankroll: 100,
  usualStakePct: 2,
  maxStakePct: 5,
  drawdownAlertPct: 20,
  edgeThreshold: 0.03,
};

const safeStorage: StateStorage = {
  getItem: async (name: string): Promise<string | null> => {
    try {
      return await AsyncStorage.getItem(name);
    } catch {
      return null;
    }
  },
  setItem: async (name: string, value: string): Promise<void> => {
    try {
      await AsyncStorage.setItem(name, value);
    } catch {
      // Ignore storage write errors on constrained devices or in test runners
    }
  },
  removeItem: async (name: string): Promise<void> => {
    try {
      await AsyncStorage.removeItem(name);
    } catch {
      // Ignore storage remove errors
    }
  },
};

export const DEFAULT_FAVOURITE_TEAMS = ['Arsenal', 'Barcelona', 'Inter'];

function normaliseMatchKey(matchStr: string): string {
  return matchStr
    .toLowerCase()
    .replace(/\s+vs\.?\s+|\s+v\s+/g, ' vs ')
    .replace(/\s+/g, ' ')
    .trim();
}

export interface AppStoreState {
  bets: BetRecord[];
  settings: UserSettings;
  favouriteMatchIds: string[];
  favouriteTeams: string[];
  draftBet: BetDraft | null;
  addBet: (bet: Omit<BetRecord, 'id' | 'createdAt'>) => void;
  updateBetResult: (id: string, result: BetResult) => void;
  reconcileBetsWithResults: (comparisons: MatchResultComparison[]) => number;
  deleteBet: (id: string) => void;
  updateSettings: (partial: Partial<UserSettings>) => void;
  toggleFavouriteMatch: (matchId: string) => void;
  toggleFavouriteTeam: (teamName: string) => void;
  setDraftBet: (draft: BetDraft | null) => void;
  resetStoreToDefaults: () => void;
}

export const useAppStore = create<AppStoreState>()(
  persist(
    (set, get) => ({
      bets: INITIAL_SAMPLE_BETS,
      settings: DEFAULT_USER_SETTINGS,
      favouriteMatchIds: [],
      favouriteTeams: DEFAULT_FAVOURITE_TEAMS,
      draftBet: null,

      addBet: (newBet) =>
        set((state) => {
          const created: BetRecord = {
            ...newBet,
            id: `bet-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            createdAt: new Date().toISOString(),
          };
          return {
            bets: [created, ...state.bets],
            draftBet: null,
          };
        }),

      updateBetResult: (id, result) =>
        set((state) => ({
          bets: state.bets.map((bet) => (bet.id === id ? { ...bet, result } : bet)),
        })),

      reconcileBetsWithResults: (comparisons) => {
        if (!comparisons || comparisons.length === 0) {
          return 0;
        }
        const byMatchKey = new Map<string, MatchResultComparison>();
        for (const comp of comparisons) {
          byMatchKey.set(normaliseMatchKey(`${comp.home} vs ${comp.away}`), comp);
        }

        let settledCount = 0;
        const currentBets = get().bets;
        const nextBets = currentBets.map((bet) => {
          if (bet.result !== 'Pending') {
            return bet;
          }
          const matched = byMatchKey.get(normaliseMatchKey(bet.match));
          if (!matched) {
            return bet;
          }
          settledCount += 1;
          const settledResult: BetResult =
            bet.pick === matched.actual_outcome ? 'Win' : 'Loss';
          return {
            ...bet,
            result: settledResult,
            scoreline: matched.actual_score.replace(/\s*-\s*/, ' - '),
          };
        });

        if (settledCount > 0) {
          set({ bets: nextBets });
        }
        return settledCount;
      },

      deleteBet: (id) =>
        set((state) => ({
          bets: state.bets.filter((bet) => bet.id !== id),
        })),

      updateSettings: (partial) =>
        set((state) => ({
          settings: {
            ...state.settings,
            ...partial,
          },
        })),

      toggleFavouriteMatch: (matchId) =>
        set((state) => {
          const exists = state.favouriteMatchIds.includes(matchId);
          return {
            favouriteMatchIds: exists
              ? state.favouriteMatchIds.filter((id) => id !== matchId)
              : [...state.favouriteMatchIds, matchId],
          };
        }),

      toggleFavouriteTeam: (teamName) =>
        set((state) => {
          const exists = state.favouriteTeams.includes(teamName);
          return {
            favouriteTeams: exists
              ? state.favouriteTeams.filter((t) => t !== teamName)
              : [...state.favouriteTeams, teamName],
          };
        }),

      setDraftBet: (draft) => set({ draftBet: draft }),

      resetStoreToDefaults: () =>
        set({
          bets: INITIAL_SAMPLE_BETS,
          settings: DEFAULT_USER_SETTINGS,
          favouriteMatchIds: [],
          favouriteTeams: DEFAULT_FAVOURITE_TEAMS,
          draftBet: null,
        }),
    }),
    {
      name: 'matchsense-offline-storage-v1',
      storage: createJSONStorage(() => safeStorage),
      partialize: (state) => ({
        bets: state.bets,
        settings: state.settings,
        favouriteMatchIds: state.favouriteMatchIds,
        favouriteTeams: state.favouriteTeams,
      }),
    }
  )
);
