import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist, StateStorage } from 'zustand/middleware';

import { INITIAL_SAMPLE_BETS } from '@/data/mockPicks';
import { BetDraft, BetRecord, BetResult, UserSettings } from '@/data/types';

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

export interface AppStoreState {
  bets: BetRecord[];
  settings: UserSettings;
  favouriteMatchIds: string[];
  draftBet: BetDraft | null;
  addBet: (bet: Omit<BetRecord, 'id' | 'createdAt'>) => void;
  updateBetResult: (id: string, result: BetResult) => void;
  deleteBet: (id: string) => void;
  updateSettings: (partial: Partial<UserSettings>) => void;
  toggleFavouriteMatch: (matchId: string) => void;
  setDraftBet: (draft: BetDraft | null) => void;
  resetStoreToDefaults: () => void;
}

export const useAppStore = create<AppStoreState>()(
  persist(
    (set) => ({
      bets: INITIAL_SAMPLE_BETS,
      settings: DEFAULT_USER_SETTINGS,
      favouriteMatchIds: [],
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

      setDraftBet: (draft) => set({ draftBet: draft }),

      resetStoreToDefaults: () =>
        set({
          bets: INITIAL_SAMPLE_BETS,
          settings: DEFAULT_USER_SETTINGS,
          favouriteMatchIds: [],
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
      }),
    }
  )
);
