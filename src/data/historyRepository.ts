import { resolveCandidateUrls } from '@/data/picksRepository';
import { HistoryEntry, HistoryPayload } from '@/data/types';

const PICKS_URL = process.env.EXPO_PUBLIC_PICKS_URL;
const REQUEST_TIMEOUT_MS = 15_000;

/** history.json is published next to picks.json by the daily job. */
export function historyUrlFrom(picksUrl: string): string {
  return picksUrl.replace(/[^/]*$/, 'history.json');
}

function isEntry(value: unknown): value is HistoryEntry {
  if (!value || typeof value !== 'object') return false;
  const e = value as Partial<HistoryEntry>;
  return (
    typeof e.id === 'string' &&
    typeof e.date === 'string' &&
    typeof e.home === 'string' &&
    typeof e.away === 'string' &&
    Array.isArray(e.p) &&
    e.p.length === 3 &&
    (e.status === 'pending' || e.status === 'final' || e.status === 'no_result')
  );
}

export class HistoryLoadError extends Error {
  readonly name = 'HistoryLoadError';
}

export async function fetchHistory(
  options: { url?: string; request?: typeof fetch; timeoutMs?: number } = {}
): Promise<HistoryPayload> {
  const configured = options.url ?? PICKS_URL;
  if (!configured) {
    throw new HistoryLoadError('EXPO_PUBLIC_PICKS_URL is not set, so the history file cannot be found.');
  }
  const request = options.request ?? fetch;
  const candidates = resolveCandidateUrls(historyUrlFrom(configured), options.url === undefined);
  let lastError = 'The history file could not be loaded.';
  for (const url of candidates) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? REQUEST_TIMEOUT_MS);
    try {
      const response = await request(url, { signal: controller.signal });
      if (!response.ok) {
        lastError =
          response.status === 404
            ? 'No history yet. It appears after the daily job has run with the dataset code.'
            : `The server returned HTTP ${response.status}.`;
        continue;
      }
      const body = (await response.json()) as Partial<HistoryPayload>;
      const entries = Array.isArray(body.entries) ? body.entries.filter(isEntry) : [];
      return {
        schema_version: String(body.schema_version ?? '1'),
        generated_at: String(body.generated_at ?? ''),
        entries,
      };
    } catch (error) {
      lastError =
        (error as { name?: string })?.name === 'AbortError'
          ? 'The server took too long to respond.'
          : 'The history file could not be reached. Check your connection.';
    } finally {
      clearTimeout(timeout);
    }
  }
  throw new HistoryLoadError(lastError);
}
