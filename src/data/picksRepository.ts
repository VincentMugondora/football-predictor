import AsyncStorage from '@react-native-async-storage/async-storage';

import { MatchPick, PicksPayload, PicksRepository } from '@/data/types';

const CACHE_KEY = 'football-predictor-live-picks-v1';
const PICKS_URL = process.env.EXPO_PUBLIC_PICKS_URL;
const REQUEST_TIMEOUT_MS = 12_000;

function isFiniteTuple(value: unknown): value is [number, number, number] {
  return (
    Array.isArray(value) &&
    value.length === 3 &&
    value.every((item) => typeof item === 'number' && Number.isFinite(item))
  );
}

function validatePayload(value: unknown): PicksPayload {
  if (!value || typeof value !== 'object') {
    throw new Error('The live picks response is not an object.');
  }
  const candidate = value as Partial<PicksPayload>;
  if (
    typeof candidate.generated_at !== 'string' ||
    !Number.isFinite(Date.parse(candidate.generated_at)) ||
    !Array.isArray(candidate.matches) ||
    !candidate.backtest ||
    typeof candidate.backtest.verdict !== 'string'
  ) {
    throw new Error('The live picks response is missing required fields.');
  }
  for (const match of candidate.matches) {
    if (
      !match ||
      typeof match.id !== 'string' ||
      !match.id ||
      typeof match.date !== 'string' ||
      !Number.isFinite(Date.parse(match.date)) ||
      typeof match.league !== 'string' ||
      typeof match.home !== 'string' ||
      typeof match.away !== 'string' ||
      !isFiniteTuple(match.p) ||
      !match.p.every((probability) => probability >= 0 && probability <= 1) ||
      Math.abs(match.p.reduce((sum, probability) => sum + probability, 0) - 1) > 0.002 ||
      (match.odds !== null && !isFiniteTuple(match.odds))
    ) {
      throw new Error('The live picks response contains an invalid match.');
    }
  }
  return candidate as PicksPayload;
}

class LivePicksRepository implements PicksRepository {
  private cached: PicksPayload | null = null;

  getCachedPicks(): PicksPayload {
    return (
      this.cached ?? {
        schema_version: '2.0',
        generated_at: new Date(0).toISOString(),
        data_status: 'no_fixtures',
        backtest: {
          verdict: 'No proven edge: treat these as estimates.',
          log_loss_model: 0,
          log_loss_book: 0,
          verdict_code: 'no_edge',
        },
        matches: [],
      }
    );
  }

  async getPicks(): Promise<PicksPayload> {
    const cached = await AsyncStorage.getItem(CACHE_KEY);
    if (cached) {
      try {
        this.cached = validatePayload(JSON.parse(cached));
      } catch {
        await AsyncStorage.removeItem(CACHE_KEY);
      }
    }

    if (!PICKS_URL) {
      if (this.cached) return this.cached;
      throw new Error('Set EXPO_PUBLIC_PICKS_URL to the published picks.json URL.');
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(PICKS_URL, { signal: controller.signal });
      if (!response.ok) throw new Error(`Picks server returned HTTP ${response.status}.`);
      const payload = validatePayload(await response.json());
      const serialized = JSON.stringify(payload);
      if (serialized.length > 50 * 1024) throw new Error('Picks response exceeds 50 KB.');
      this.cached = payload;
      await AsyncStorage.setItem(CACHE_KEY, serialized);
      return payload;
    } catch (error) {
      if (this.cached) return this.cached;
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  getMatchById(id: string): MatchPick | undefined {
    return this.cached?.matches.find((match) => match.id === id);
  }
}

export const picksRepository = new LivePicksRepository();
