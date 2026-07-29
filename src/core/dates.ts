// Local-date helpers. LocalDate is always "YYYY-MM-DD" in the user's
// timezone. All arithmetic is done in UTC space on purpose so DST shifts
// can never make a "day" 23 or 25 hours long.

import type { LocalDate } from './types';

/** Parse "YYYY-MM-DD" into a UTC-midnight timestamp (ms). */
function toUtcMs(date: LocalDate): number {
  const [y, m, d] = date.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

function fromUtcMs(ms: number): LocalDate {
  const d = new Date(ms);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function addDays(date: LocalDate, days: number): LocalDate {
  return fromUtcMs(toUtcMs(date) + days * 86_400_000);
}

/** Signed whole days from `a` to `b` (positive when b is later). */
export function daysBetween(a: LocalDate, b: LocalDate): number {
  return Math.round((toUtcMs(b) - toUtcMs(a)) / 86_400_000);
}

/** 0 = Sunday … 6 = Saturday, matching routines.schedule_days. */
export function weekdayOf(date: LocalDate): number {
  return new Date(toUtcMs(date)).getUTCDay();
}

/**
 * Today's date in an IANA timezone. Intl is available in Node, browsers,
 * and React Native (Hermes), so this stays portable.
 */
export function todayInTz(timezone: string, now: Date = new Date()): LocalDate {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return fmt.format(now); // en-CA formats as YYYY-MM-DD
}

/** Current "HH:MM" wall-clock time in an IANA timezone. */
export function timeInTz(timezone: string, now: Date = new Date()): string {
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
  return fmt.format(now);
}

/** "HH:MM" → minutes since midnight. */
export function minutesOfDay(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}
