// Payment provider abstraction. Feature code never talks to a provider —
// it only reads the subscriptions table via hasPremium(). Providers are
// responsible for keeping that table truthful.
//
// To add Apple/Google via RevenueCat later: implement this interface in
// revenuecat.ts and register it in ./index.ts. Nothing else changes.

import type { Subscription, UserId } from '../types';

export type Plan = 'monthly' | 'yearly';

export interface EntitlementResult {
  active: boolean;
  plan: Plan | null;
  /** Provider's own id for the membership/purchase, for audit. */
  providerMembershipId: string | null;
  /** When the current paid period ends, if the provider reports it. */
  currentPeriodEnd: string | null;
}

export interface PaymentProvider {
  readonly name: string;

  /** Ask the provider whether this user currently has an active membership. */
  verifyEntitlement(user: { id: UserId; email: string }): Promise<EntitlementResult>;

  /** URL to send the user to for checkout of a plan. */
  checkoutUrl(plan: Plan, user: { id: UserId; email: string }): string;
}

/** Shape an EntitlementResult into a subscriptions-table row. */
export function toSubscription(
  provider: PaymentProvider,
  userId: UserId,
  result: EntitlementResult,
): Subscription {
  return {
    userId,
    provider: provider.name,
    status: result.active ? 'active' : 'none',
    plan: result.plan,
    currentPeriodEnd: result.currentPeriodEnd,
  };
}
