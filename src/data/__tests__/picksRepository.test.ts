import { afterEach, describe, expect, it, jest } from '@jest/globals';

import { LivePicksRepository } from '@/data/picksRepository';

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(async () => null),
    setItem: jest.fn(async () => undefined),
    removeItem: jest.fn(async () => undefined),
  },
}));

const TEST_URL = 'https://example.test/picks.json';

function makeStorage() {
  return {
    getItem: jest.fn(async () => null),
    setItem: jest.fn(async () => undefined),
    removeItem: jest.fn(async () => undefined),
  };
}

function makeRequest(implementation?: (...args: unknown[]) => unknown) {
  return (jest.fn(implementation ?? (async () => response({
    generated_at: new Date(Date.now() - 60_000).toISOString(),
    matches: [],
    backtest: { verdict: 'No proven edge', log_loss_model: 0.9, log_loss_book: null },
  }))) as unknown) as typeof fetch;
}

function response(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

afterEach(() => {
  jest.restoreAllMocks();
});

describe('LivePicksRepository diagnostics', () => {
  it('accepts schema v2 minute windows with league-average status', async () => {
    const windows = Object.fromEntries(['0-15', '16-30', '31-45+', '46-60', '61-75', '76-90+'].map((label) => [label, {
      expected_goals: 0.1,
      p_at_least_one: 0.095,
    }]));
    const payload = {
      generated_at: new Date(Date.now() - 60_000).toISOString(),
      matches: [{
        id: 'fixture-minute', date: new Date(Date.now() + 60_000).toISOString(), league: 'Premier League',
        home: 'Arsenal', away: 'Chelsea', p: [0.5, 0.25, 0.25], odds: null,
        timing: {
          level: 'minute', halves: null,
          windows: {
            home: windows, away: windows, p_first_goal_before_30: 0.4,
            team_specific_signal: false, league_goal_sample: 12,
          },
          note: 'league average, no team-specific signal yet.',
        },
      }],
      backtest: { verdict: 'No proven edge', log_loss_model: 0.9, log_loss_book: null },
    };
    const repository = new LivePicksRepository({
      url: TEST_URL,
      request: makeRequest(async () => response(payload)),
      storage: makeStorage(),
    });

    await expect(repository.getPicks()).resolves.toMatchObject({
      matches: [{ timing: { level: 'minute', windows: { team_specific_signal: false, league_goal_sample: 12 } } }],
    });
  });

  it('reports URL not configured', async () => {
    const repository = new LivePicksRepository({ url: '', request: makeRequest(), storage: makeStorage() });
    await expect(repository.getPicks()).rejects.toMatchObject({
      kind: 'url_not_configured',
      url: null,
      message: expect.stringContaining('EXPO_PUBLIC_PICKS_URL'),
    });
  });

  it('reports an unreachable network and logs the exact request URL', async () => {
    const request = makeRequest(async () => {
      throw new TypeError('Network request failed');
    });
    const log = jest.spyOn(console, 'info').mockImplementation(() => undefined);
    const repository = new LivePicksRepository({ url: TEST_URL, request, storage: makeStorage() });

    await expect(repository.getPicks()).rejects.toMatchObject({ kind: 'network_unreachable', url: TEST_URL });
    expect(request).toHaveBeenCalledWith(TEST_URL, expect.objectContaining({ signal: expect.any(AbortSignal) }));
    expect(log).toHaveBeenCalledWith(`[picks] Requesting exact URL: ${TEST_URL}`);
  });

  it('reports request timeout', async () => {
    const request = makeRequest((_url, init) => new Promise((_resolve, reject) => {
      (init as RequestInit).signal?.addEventListener('abort', () => {
        reject(Object.assign(new Error('Aborted'), { name: 'AbortError' }));
      });
    }));
    const repository = new LivePicksRepository({ url: TEST_URL, request, storage: makeStorage(), timeoutMs: 1 });

    await expect(repository.getPicks()).rejects.toMatchObject({ kind: 'timeout', url: TEST_URL });
  });

  it('reports the HTTP status code', async () => {
    const repository = new LivePicksRepository({
      url: TEST_URL,
      request: makeRequest(async () => response({}, 503)),
      storage: makeStorage(),
    });

    await expect(repository.getPicks()).rejects.toMatchObject({
      kind: 'http_status', status: 503, url: TEST_URL, message: expect.stringContaining('HTTP 503'),
    });
  });

  it('reports invalid JSON separately from schema errors', async () => {
    const repository = new LivePicksRepository({
      url: TEST_URL,
      request: makeRequest(async () => ({ ok: true, status: 200, json: async () => { throw new SyntaxError('bad json'); } } as unknown as Response)),
      storage: makeStorage(),
    });

    await expect(repository.getPicks()).rejects.toMatchObject({ kind: 'invalid_json', url: TEST_URL });
  });

  it('names the invalid schema field', async () => {
    const badPayload = {
      generated_at: new Date(Date.now() - 60_000).toISOString(),
      matches: [{
        id: 'fixture-1', date: new Date(Date.now() + 60_000).toISOString(), league: 'Premier League',
        home: 'Arsenal', away: 'Chelsea', p: [0.6, 0.2], odds: null,
      }],
      backtest: { verdict: 'No proven edge', log_loss_model: 0.9, log_loss_book: null },
    };
    const repository = new LivePicksRepository({
      url: TEST_URL,
      request: makeRequest(async () => response(badPayload)),
      storage: makeStorage(),
    });

    await expect(repository.getPicks()).rejects.toMatchObject({
      kind: 'schema_validation_failed', field: 'matches[0].p', url: TEST_URL,
      message: expect.stringContaining('matches[0].p'),
    });
  });
});
