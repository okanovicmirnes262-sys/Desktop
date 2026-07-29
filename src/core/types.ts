// Platform-agnostic domain types. No web/DOM assumptions here — this module
// (and everything under src/core/) must stay importable from a future
// React Native app.

export type UserId = string;
export type RoutineId = string;
export type StepId = string;

/** ISO date string in the user's local timezone, e.g. "2026-07-29". */
export type LocalDate = string;

export interface Profile {
  id: UserId;
  displayName: string | null;
  /** IANA timezone, e.g. "Europe/Berlin". Defines where a "day" starts. */
  timezone: string;
  theme: string;
  onboarded: boolean;
}

export interface Routine {
  id: RoutineId;
  userId: UserId;
  name: string;
  emoji: string;
  position: number;
  /** Active weekdays, 0 = Sunday … 6 = Saturday. */
  scheduleDays: number[];
  /** "HH:MM" user-local wall-clock time, or null when reminders are off. */
  reminderTime: string | null;
  /** Optional whole-routine timer. */
  timerSeconds: number | null;
  isArchived: boolean;
}

export interface Step {
  id: StepId;
  routineId: RoutineId;
  title: string;
  position: number;
  /** Optional per-step timer. */
  timerSeconds: number | null;
}

export interface Completion {
  id: string;
  routineId: RoutineId;
  completedOn: LocalDate;
}

export interface StreakState {
  routineId: RoutineId;
  currentStreak: number;
  bestStreak: number;
  lastCompletedOn: LocalDate | null;
  /** Banked streak freezes, 0–3. */
  freezeBalance: number;
  /** Completions counted toward the next earned freeze, 0–6. */
  freezeProgress: number;
}

export type SubscriptionStatus = 'none' | 'active' | 'past_due' | 'canceled';

export interface Subscription {
  userId: UserId;
  provider: string;
  status: SubscriptionStatus;
  plan: 'monthly' | 'yearly' | null;
  currentPeriodEnd: string | null;
}
