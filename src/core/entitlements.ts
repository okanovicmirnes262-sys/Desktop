// Feature gating. ALL premium checks in the app flow through hasPremium()
// so swapping payment providers never touches feature code.

import type { Subscription } from './types';

export const FREE_LIMITS = {
  maxRoutines: 3,
} as const;

export const PRICING = {
  monthly: { amount: 5, currency: 'EUR', label: '€5 / month' },
  yearly: { amount: 40, currency: 'EUR', label: '€40 / year' },
} as const;

/** The single premium check. `null` = no subscription row = free tier. */
export function hasPremium(sub: Subscription | null, now: Date = new Date()): boolean {
  if (!sub || sub.status !== 'active') return false;
  // No period end recorded → trust the status until the next webhook/verify.
  if (!sub.currentPeriodEnd) return true;
  return new Date(sub.currentPeriodEnd).getTime() > now.getTime();
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
