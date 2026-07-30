// The streak + streak-freeze engine. Pure functions only: state in,
// state out, plus an event list the caller persists to freeze_events.
//
// The rules, explicitly:
//
// 1. `lastCompletedOn` means "the streak is alive through this date" —
//    either a real completion or a day covered by a freeze.
// 2. Completing on consecutive days grows the streak by 1 per day.
//    Completing twice on the same day is a no-op (idempotent).
// 3. A missed day consumes 1 banked freeze and keeps the streak alive
//    (the frozen day does NOT increment the streak — it just survives).
// 4. Freezes are consumed one per missed day, oldest gap first. When the
//    bank runs out mid-gap, the streak breaks: current resets to 0 and
//    NO further freezes are consumed (nothing is wasted on a lost cause).
// 5. Earning: every 7 completions adds 1 freeze, banked up to 3. While
//    the bank is full, progress is paused (not silently discarded), so a
//    "would-be" freeze is never lost — kind, and easy to explain in UI.
// 6. Breaking a streak resets earn progress to 0. Banked freezes survive.
// 7. A "rest day" (user-declared planned skip) bridges the streak for
//    free: no freeze consumed, no growth — the day just doesn't count
//    against you. The monthly limit lives in the app layer, not here.

import type { LocalDate, StreakState } from './types';
import { addDays, daysBetween } from './dates';

export const MAX_FREEZES = 3;
export const COMPLETIONS_PER_FREEZE = 7;
export const REST_DAYS_PER_MONTH = 2;

export interface FreezeEvent {
  kind: 'earned' | 'consumed';
  /** The date the freeze covered (consumed) or was earned on. */
  onDate: LocalDate;
}

export interface StreakResult {
  state: StreakState;
  events: FreezeEvent[];
}

/**
 * Bring a streak up to date as of `today` WITHOUT recording a completion.
 * Consumes freezes for every fully-elapsed missed day (yesterday and
 * earlier). Call this on read and before applyCompletion so the stored
 * state never lags reality.
 */
export function reconcile(
  state: StreakState,
  today: LocalDate,
  restDays?: ReadonlySet<LocalDate>,
): StreakResult {
  const events: FreezeEvent[] = [];
  const next = { ...state };

  if (next.lastCompletedOn === null || next.currentStreak === 0) {
    return { state: next, events };
  }

  // Walk each fully-missed day between alive-through and today.
  // Today itself is never "missed" — the user can still complete it.
  while (daysBetween(next.lastCompletedOn!, today) > 1) {
    const missedDay = addDays(next.lastCompletedOn!, 1);
    if (restDays?.has(missedDay)) {
      // Planned skip: bridge for free, no freeze spent, no growth.
      next.lastCompletedOn = missedDay;
    } else if (next.freezeBalance > 0) {
      next.freezeBalance -= 1;
      next.lastCompletedOn = missedDay; // alive through the frozen day
      events.push({ kind: 'consumed', onDate: missedDay });
    } else {
      // Bank empty: streak breaks. Progress resets, banked freezes (none
      // left anyway) and best streak are untouched.
      next.currentStreak = 0;
      next.freezeProgress = 0;
      break;
    }
  }

  return { state: next, events };
}

/**
 * Record a completion for `today`. Reconciles first, so callers can pass
 * stale state safely. Idempotent for repeat completions on the same day.
 */
export function applyCompletion(
  state: StreakState,
  today: LocalDate,
  restDays?: ReadonlySet<LocalDate>,
): StreakResult {
  const { state: next, events } = reconcile(state, today, restDays);

  if (next.lastCompletedOn === today && next.currentStreak > 0) {
    return { state: next, events }; // already counted today
  }

  const continues =
    next.currentStreak > 0 &&
    next.lastCompletedOn !== null &&
    daysBetween(next.lastCompletedOn, today) === 1;

  next.currentStreak = continues ? next.currentStreak + 1 : 1;
  next.lastCompletedOn = today;
  next.bestStreak = Math.max(next.bestStreak, next.currentStreak);

  // Earn progress pauses while the bank is full so nothing is wasted.
  if (next.freezeBalance < MAX_FREEZES) {
    next.freezeProgress += 1;
    if (next.freezeProgress >= COMPLETIONS_PER_FREEZE) {
      next.freezeProgress = 0;
      next.freezeBalance += 1;
      events.push({ kind: 'earned', onDate: today });
    }
  }

  return { state: next, events };
}

/** Fresh state for a brand-new routine. */
export function initialStreakState(routineId: string): StreakState {
  return {
    routineId,
    currentStreak: 0,
    bestStreak: 0,
    lastCompletedOn: null,
    freezeBalance: 0,
    freezeProgress: 0,
  };
}
