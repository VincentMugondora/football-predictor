import { describe, expect, it } from '@jest/globals';

import { formatUpdatedRelative, isDataStale } from '@/lib/dateUtils';

describe('dateUtils', () => {
  const fixedNow = new Date('2026-10-18T12:00:00Z');

  it('detects stale data when older than 3 days', () => {
    const twoHoursAgo = '2026-10-18T10:00:00Z';
    const fourDaysAgo = '2026-10-14T10:00:00Z';

    expect(isDataStale(twoHoursAgo, fixedNow)).toBe(false);
    expect(isDataStale(fourDaysAgo, fixedNow)).toBe(true);
  });

  it('formats relative update labels clearly', () => {
    expect(formatUpdatedRelative('2026-10-18T10:00:00Z', fixedNow)).toBe(
      'Updated 2h ago'
    );
    expect(formatUpdatedRelative('2026-10-14T12:00:00Z', fixedNow)).toBe(
      'Updated 4d ago'
    );
  });
});
