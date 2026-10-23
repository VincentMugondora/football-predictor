import AsyncStorage from '@react-native-async-storage/async-storage';

import { GoalTimeWindow, MatchPick, MinuteWindowPrediction, PicksPayload, PicksRepository } from '@/data/types';

const CACHE_KEY = 'football-predictor-live-picks-v1';
const PICKS_URL = process.env.EXPO_PUBLIC_PICKS_URL;
const REQUEST_TIMEOUT_MS = 12_000;
const MAX_PICKS_BYTES = 50 * 1024;

export type PicksLoadErrorKind =
  | 'url_not_configured'
  | 'network_unreachable'
  | 'timeout'
  | 'http_status'
  | 'invalid_json'
  | 'schema_validation_failed';

export class PicksLoadError extends Error {
  readonly name = 'PicksLoadError';

  constructor(
    readonly kind: PicksLoadErrorKind,
    message: string,
    readonly url: string | null,
    readonly field?: string,
    readonly status?: number
  ) {
    super(message);
  }
}

type PicksStorage = Pick<typeof AsyncStorage, 'getItem' | 'setItem' | 'removeItem'>;

interface RepositoryOptions {
  url?: string;
  request?: typeof fetch;
  storage?: PicksStorage;
  timeoutMs?: number;
}

function schemaFailure(field: string, url: string): never {
  throw new PicksLoadError(
    'schema_validation_failed',
    `The picks data failed validation at “${field}”. Ask the publisher to check this field.`,
    url,
    field
  );
}

function isFiniteTuple(value: unknown): value is [number, number, number] {
  return (
    Array.isArray(value) &&
    value.length === 3 &&
    value.every((item) => typeof item === 'number' && Number.isFinite(item))
  );
}

function isProbability(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;
}

function utf8ByteLength(value: string): number {
  return encodeURIComponent(value).replace(/%[A-F\d]{2}/gi, 'U').length;
}

function validatePayload(value: unknown, url: string): PicksPayload {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new PicksLoadError(
      'schema_validation_failed',
      'The picks data failed validation at “root”. The response must be a JSON object.',
      url,
      'root'
    );
  }
  const candidate = value as Partial<PicksPayload>;
  const generatedAt = candidate.generated_at;
  if (typeof generatedAt !== 'string' || !Number.isFinite(Date.parse(generatedAt))) {
    throw new PicksLoadError('schema_validation_failed', 'The picks data has a missing or invalid “generated_at” field.', url, 'generated_at');
  }
  if (!Array.isArray(candidate.matches)) {
    throw new PicksLoadError('schema_validation_failed', 'The picks data has a missing or invalid “matches” field.', url, 'matches');
  }
  if (!candidate.backtest || typeof candidate.backtest !== 'object') {
    throw new PicksLoadError('schema_validation_failed', 'The picks data has a missing or invalid “backtest” field.', url, 'backtest');
  }
  if (typeof candidate.backtest.verdict !== 'string') {
    throw new PicksLoadError('schema_validation_failed', 'The picks data has a missing or invalid “backtest.verdict” field.', url, 'backtest.verdict');
  }

  candidate.matches.forEach((match, index) => {
    const prefix = `matches[${index}]`;
    if (!match || typeof match !== 'object') schemaFailure(`${prefix}`, url);
    if (typeof match.id !== 'string' || !match.id) schemaFailure(`${prefix}.id`, url);
    if (typeof match.date !== 'string' || !Number.isFinite(Date.parse(match.date))) schemaFailure(`${prefix}.date`, url);
    if (typeof match.league !== 'string') schemaFailure(`${prefix}.league`, url);
    if (typeof match.home !== 'string') schemaFailure(`${prefix}.home`, url);
    if (typeof match.away !== 'string') schemaFailure(`${prefix}.away`, url);
    if (match.low_confidence !== undefined && typeof match.low_confidence !== 'boolean') {
      schemaFailure(`${prefix}.low_confidence`, url);
    }
    if (
      !isFiniteTuple(match.p) ||
      !match.p.every((probability) => probability >= 0 && probability <= 1) ||
      Math.abs(match.p.reduce((sum, probability) => sum + probability, 0) - 1) > 0.002
    ) {
      schemaFailure(`${prefix}.p`, url);
    }
    if (match.odds !== null && !isFiniteTuple(match.odds)) schemaFailure(`${prefix}.odds`, url);
    if (Date.parse(match.date) <= Date.parse(generatedAt)) {
      schemaFailure(`${prefix}.date`, url);
    }
    if (match.goals !== undefined) {
      const goals = match.goals;
      if (!goals || typeof goals !== 'object') schemaFailure(`${prefix}.goals`, url);
      if (![goals.exp_home, goals.exp_away, goals.exp_total].every((value) => typeof value === 'number' && Number.isFinite(value) && value >= 0)) {
        schemaFailure(`${prefix}.goals.expected`, url);
      }
      if (!Array.isArray(goals.p_total) || goals.p_total.length !== 5 || !goals.p_total.every(isProbability) || Math.abs(goals.p_total.reduce((sum, item) => sum + item, 0) - 1) > 0.01) {
        schemaFailure(`${prefix}.goals.p_total`, url);
      }
      if (!goals.over || !['0.5', '1.5', '2.5', '3.5'].every((line) => isProbability(goals.over[line as keyof typeof goals.over]))) {
        schemaFailure(`${prefix}.goals.over`, url);
      }
      const overs = ['0.5', '1.5', '2.5', '3.5'].map((line) => goals.over[line as keyof typeof goals.over]);
      if (overs.some((value, index) => index > 0 && value > overs[index - 1])) schemaFailure(`${prefix}.goals.over`, url);
      if (!isProbability(goals.btts)) schemaFailure(`${prefix}.goals.btts`, url);
      if (!Array.isArray(goals.clean_sheet) || goals.clean_sheet.length !== 2 || !goals.clean_sheet.every(isProbability)) {
        schemaFailure(`${prefix}.goals.clean_sheet`, url);
      }
      if (!Array.isArray(goals.top_scores) || goals.top_scores.length !== 3 || goals.top_scores.some((score) => !score || typeof score.score !== 'string' || !isProbability(score.probability))) {
        schemaFailure(`${prefix}.goals.top_scores`, url);
      }
    }
    if (match.winner !== undefined) {
      if (!match.winner || !['home', 'draw', 'away', 'too close to call'].includes(match.winner.pick)) {
        schemaFailure(`${prefix}.winner.pick`, url);
      }
      if (!isFiniteTuple(match.winner.p) || !match.winner.p.every(isProbability) || Math.abs(match.winner.p.reduce((sum, p) => sum + p, 0) - 1) > 0.01) {
        schemaFailure(`${prefix}.winner.p`, url);
      }
      if (!['low', 'medium', 'high'].includes(match.winner.confidence)) schemaFailure(`${prefix}.winner.confidence`, url);
    }
    if (match.timing !== undefined) {
      const timing = match.timing;
      if (!timing || !['minute', 'half', 'none'].includes(timing.level)) schemaFailure(`${prefix}.timing.level`, url);
      if (timing.halves !== null) {
        const halves = timing.halves;
        if (!halves || !['home', 'away'].every((side) => {
          const half = halves[side as 'home' | 'away'];
          return half && [half.first, half.second].every((value) => typeof value === 'number' && Number.isFinite(value) && value >= 0);
        }) || !isProbability(halves.p_first_half_goal) || !isProbability(halves.league_first_share) || typeof halves.team_specific_signal !== 'boolean') {
          schemaFailure(`${prefix}.timing.halves`, url);
        }
      }
      if (timing.windows !== null) {
        const windows = timing.windows;
        const labels: GoalTimeWindow[] = ['0-15', '16-30', '31-45+', '46-60', '61-75', '76-90+'];
        const validSide = (side: MinuteWindowPrediction['home']) => side && labels.every((label) => {
          const window = side[label];
          return window
            && typeof window.expected_goals === 'number'
            && Number.isFinite(window.expected_goals)
            && window.expected_goals >= 0
            && isProbability(window.p_at_least_one);
        });
        if (!windows || !validSide(windows.home) || !validSide(windows.away)
          || !isProbability(windows.p_first_goal_before_30)
          || typeof windows.team_specific_signal !== 'boolean'
          || !Number.isInteger(windows.league_goal_sample) || windows.league_goal_sample < 0) {
          schemaFailure(`${prefix}.timing.windows`, url);
        }
      }
      if (timing.level === 'minute' && timing.windows === null) schemaFailure(`${prefix}.timing.windows`, url);
      if (timing.level !== 'minute' && timing.windows !== null) schemaFailure(`${prefix}.timing.windows`, url);
      if (typeof timing.note !== 'string') schemaFailure(`${prefix}.timing.note`, url);
    }
  });
  return candidate as PicksPayload;
}

export class LivePicksRepository implements PicksRepository {
  private cached: PicksPayload | null = null;
  private readonly url: string | undefined;
  private readonly request: typeof fetch;
  private readonly storage: PicksStorage;
  private readonly timeoutMs: number;

  constructor(options: RepositoryOptions = {}) {
    this.url = options.url ?? PICKS_URL;
    this.request = options.request ?? fetch;
    this.storage = options.storage ?? AsyncStorage;
    this.timeoutMs = options.timeoutMs ?? REQUEST_TIMEOUT_MS;
  }

  getCachedPicks(): PicksPayload | null {
    return this.cached;
  }

  async getPicks(): Promise<PicksPayload> {
    try {
      const cached = await this.storage.getItem(CACHE_KEY);
      if (cached) {
        try {
          this.cached = validatePayload(JSON.parse(cached), this.url ?? '');
        } catch {
          await this.storage.removeItem(CACHE_KEY).catch(() => undefined);
          this.cached = null;
        }
      }
    } catch {
      // A storage failure should not prevent trying the live endpoint.
    }

    if (!this.url?.trim()) {
      if (this.cached) return this.cached;
      const error = new PicksLoadError(
        'url_not_configured',
        'The picks URL is not configured. Set EXPO_PUBLIC_PICKS_URL and rebuild the app.',
        null
      );
      console.error('[picks] URL not configured; expected EXPO_PUBLIC_PICKS_URL.');
      throw error;
    }

    const requestedUrl = this.url;
    console.info(`[picks] Requesting exact URL: ${requestedUrl}`);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      let response: Response;
      try {
        response = await this.request(requestedUrl, { signal: controller.signal });
      } catch (cause) {
        if ((cause as { name?: string })?.name === 'AbortError') {
          throw new PicksLoadError('timeout', 'The picks server took too long to respond. Try again when your connection is better.', requestedUrl);
        }
        throw new PicksLoadError('network_unreachable', 'The picks server could not be reached. Check your internet connection and try again.', requestedUrl);
      }
      if (!response.ok) {
        throw new PicksLoadError(
          'http_status',
          `The picks server returned HTTP ${response.status}. Try again later or contact the publisher.`,
          requestedUrl,
          undefined,
          response.status
        );
      }

      let body: unknown;
      try {
        body = await response.json();
      } catch {
        throw new PicksLoadError('invalid_json', 'The picks server returned invalid JSON. Contact the publisher.', requestedUrl);
      }
      const payload = validatePayload(body, requestedUrl);
      const serialized = JSON.stringify(payload);
      if (utf8ByteLength(serialized) > MAX_PICKS_BYTES) {
        throw new PicksLoadError('schema_validation_failed', 'The picks data failed validation at “payload_size” (over 50 KB).', requestedUrl, 'payload_size');
      }
      this.cached = payload;
      await this.storage.setItem(CACHE_KEY, serialized).catch(() => undefined);
      return payload;
    } catch (error) {
      const typedError = error instanceof PicksLoadError
        ? error
        : new PicksLoadError('network_unreachable', 'The picks server could not be reached. Check your internet connection and try again.', requestedUrl);
      console.error('[picks] Request failed:', { url: requestedUrl, kind: typedError.kind, message: typedError.message });
      if (this.cached) return this.cached;
      throw typedError;
    } finally {
      clearTimeout(timeout);
    }
  }

  getMatchById(id: string): MatchPick | undefined {
    return this.cached?.matches.find((match) => match.id === id);
  }
}

export const picksRepository = new LivePicksRepository();
