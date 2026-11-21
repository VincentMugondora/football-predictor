const MS_PER_MINUTE = 60 * 1000;
const MS_PER_HOUR = 60 * MS_PER_MINUTE;
const MS_PER_DAY = 24 * MS_PER_HOUR;
const STALE_THRESHOLD_DAYS = 3;

/**
 * Returns true when generatedAt is older than 3 days relative to `now`.
 */
export function isDataStale(generatedAtIso: string, now: Date = new Date()): boolean {
  const generatedTime = new Date(generatedAtIso).getTime();
  if (Number.isNaN(generatedTime)) {
    return true;
  }
  const ageMs = now.getTime() - generatedTime;
  return ageMs > STALE_THRESHOLD_DAYS * MS_PER_DAY;
}

/**
 * Formats an ISO timestamp into a compact relative label such as "Updated 2h ago" or "Updated 4d ago".
 */
export function formatUpdatedRelative(
  generatedAtIso: string,
  now: Date = new Date()
): string {
  const generatedTime = new Date(generatedAtIso).getTime();
  if (Number.isNaN(generatedTime)) {
    return 'Updated recently';
  }
  const diffMs = Math.max(0, now.getTime() - generatedTime);
  const minutes = Math.floor(diffMs / MS_PER_MINUTE);
  if (minutes < 60) {
    return `Updated ${Math.max(1, minutes)}m ago`;
  }
  const hours = Math.floor(diffMs / MS_PER_HOUR);
  if (hours < 24) {
    return `Updated ${hours}h ago`;
  }
  const days = Math.floor(diffMs / MS_PER_DAY);
  return `Updated ${days}d ago`;
}

/**
 * Formats a match date into an uppercase section pill header like "SAT 24 OCT".
 */
export function formatMatchDayHeader(isoDate: string): string {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) {
    return isoDate.toUpperCase();
  }
  const shortDays = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  const months = [
    'JAN',
    'FEB',
    'MAR',
    'APR',
    'MAY',
    'JUN',
    'JUL',
    'AUG',
    'SEP',
    'OCT',
    'NOV',
    'DEC',
  ];
  const dayName = shortDays[date.getUTCDay()] ?? '';
  const dayNum = date.getUTCDate();
  const monthName = months[date.getUTCMonth()] ?? '';
  return `${dayName} ${dayNum} ${monthName}`;
}

/**
 * Formats a match date into "Sat 24 Oct" for the Match of the Week card.
 */
export function formatShortDayAndMonth(isoDate: string): string {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) {
    return isoDate;
  }
  const shortDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];
  const dayName = shortDays[date.getUTCDay()] ?? '';
  const dayNum = date.getUTCDate();
  const monthName = months[date.getUTCMonth()] ?? '';
  return `${dayName} ${dayNum} ${monthName}`;
}

/**
 * Formats a match kickoff time in 24-hour HH:mm UTC so tests and devices render deterministically.
 */
export function formatKickoffTime(isoDate: string): string {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) {
    return '--:--';
  }
  const hours = String(date.getUTCHours()).padStart(2, '0');
  const minutes = String(date.getUTCMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

/**
 * Formats a compact header timestamp like "Sat 24 Oct, 19:30".
 */
export function formatShortDayAndTime(isoDate: string): string {
  return `${formatShortDayAndMonth(isoDate)}, ${formatKickoffTime(isoDate)}`;
}

export type DayFilter = 'today' | 'tomorrow' | 'week';

export const DAY_FILTER_LABELS: Record<DayFilter, string> = {
  today: 'Today',
  tomorrow: 'Tomorrow',
  week: 'This week',
};

function startOfLocalDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** True when the kickoff falls in the chosen day range, using the phone's local time. */
export function matchesDayFilter(
  isoDate: string,
  filter: DayFilter,
  now: Date = new Date()
): boolean {
  const kickoff = new Date(isoDate);
  if (Number.isNaN(kickoff.getTime())) return filter === 'week';
  const dayOffset = Math.round((startOfLocalDay(kickoff) - startOfLocalDay(now)) / DAY_MS);
  if (filter === 'today') return dayOffset === 0;
  if (filter === 'tomorrow') return dayOffset === 1;
  // "This week" also keeps any already-started matches from an older cached file.
  return dayOffset < 7;
}

const LONG_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const LONG_MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/** "Today", "Tomorrow" or "Saturday 22 November", in the phone's local time. */
export function formatDayTitle(isoDate: string, now: Date = new Date()): string {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return isoDate;
  const dayOffset = Math.round((startOfLocalDay(date) - startOfLocalDay(now)) / DAY_MS);
  if (dayOffset === 0) return 'Today';
  if (dayOffset === 1) return 'Tomorrow';
  return `${LONG_DAYS[date.getDay()]} ${date.getDate()} ${LONG_MONTHS[date.getMonth()]}`;
}

/** Local kickoff time as "15:00". */
export function formatLocalTime(isoDate: string): string {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return '';
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}
