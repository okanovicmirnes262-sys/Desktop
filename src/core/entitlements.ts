// Feature gating. ALL premium checks in the app flow through hasPremium()
// so swapping payment providers never touches feature code.

import type { Subscription } from './types';

import { DEFAULT_RULES, PREMIUM_RULES, type StreakRules } from './streak';

export const FREE_LIMITS = {
  maxRoutines: 3,
  restDaysPerMonth: 2,
  extraReminders: 0,
} as const;

export const PREMIUM_LIMITS = {
  maxRoutines: Infinity,
  restDaysPerMonth: 5,
  extraReminders: 2,
} as const;

export interface PlanLimits {
  maxRoutines: number;
  restDaysPerMonth: number;
  extraReminders: number;
  streakRules: StreakRules;
}

/** All plan-dependent numbers in one place. */
export function limitsFor(sub: Subscription | null): PlanLimits {
  const premium = hasPremium(sub);
  return premium
    ? { ...PREMIUM_LIMITS, streakRules: PREMIUM_RULES }
    : { ...FREE_LIMITS, streakRules: DEFAULT_RULES };
}

export const PRICING = {
  monthly: { amount: 5, currency: 'EUR', label: '€5 / month' },
  yearly: { amount: 40, currency: 'EUR', label: '€40 / year' },
} as const;

/** The single premium check. `null` = no subscription row = free tier. */
export function hasPremium(sub: Subscription | null, now: Date = new Date()): boolean {
  if (!sub || sub.status !== 'active') return false;
  // No/unparseable period end → trust the status until the next webhook/verify.
  if (!sub.currentPeriodEnd) return true;
  const end = new Date(sub.currentPeriodEnd).getTime();
  if (Number.isNaN(end)) return true;
  return end > now.getTime();
}

export function canCreateRoutine(activeRoutineCount: number, sub: Subscription | null): boolean {
  return hasPremium(sub) || activeRoutineCount < FREE_LIMITS.maxRoutines;
}

/** Premium-only feature keys, checked by UI gates. */
export type PremiumFeature = 'unlimited_routines' | 'themes' | 'full_stats' | 'backup';

export function canUseFeature(feature: PremiumFeature, sub: Subscription | null): boolean {
  switch (feature) {
    case 'unlimited_routines':
    case 'themes':
    case 'full_stats':
    case 'backup':
      return hasPremium(sub);
  }
}
