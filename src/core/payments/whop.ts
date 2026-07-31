// Whop implementation of PaymentProvider. Premium is unlocked by verifying
// an active Whop membership for the user's email against our plan ids.

import type { EntitlementResult, PaymentProvider, Plan } from './provider';

export interface WhopConfig {
  apiKey: string;
  planIdMonthly: string;
  planIdYearly: string;
  apiBase?: string; // overridable for tests
}

interface WhopMembership {
  id: string;
  status: string; // 'active' | 'trialing' | 'past_due' | 'canceled' | ...
  plan_id?: string;
  plan?: { id: string };
  renewal_period_end?: string | number | null;
  email?: string;
}

export class WhopProvider implements PaymentProvider {
  readonly name = 'whop';
  private base: string;

  constructor(private config: WhopConfig) {
    this.base = config.apiBase ?? 'https://api.whop.com/api/v2';
  }

  async verifyEntitlement(user: { id: string; email: string }): Promise<EntitlementResult> {
    // Whop v2: list memberships filtered by email; we then match our plans.
    const url = `${this.base}/memberships?email=${encodeURIComponent(user.email)}&valid=true`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${this.config.apiKey}` },
      cache: 'no-store',
    });
    if (!res.ok) {
      throw new Error(`Whop verify failed: ${res.status} ${await res.text()}`);
    }
    const body = (await res.json()) as { data?: WhopMembership[] };
    const memberships = body.data ?? [];

    const match = memberships.find((m) => {
      const planId = m.plan_id ?? m.plan?.id;
      const validStatus = m.status === 'active' || m.status === 'trialing';
      return (
        validStatus &&
        (planId === this.config.planIdMonthly || planId === this.config.planIdYearly)
      );
    });

    if (!match) {
      return { active: false, plan: null, providerMembershipId: null, currentPeriodEnd: null };
    }

    const planId = match.plan_id ?? match.plan?.id;
    // Whop reports the period end as a Unix timestamp — normalize to ISO.
    const rawEnd = match.renewal_period_end;
    return {
      active: true,
      plan: planId === this.config.planIdYearly ? 'yearly' : 'monthly',
      providerMembershipId: match.id,
      currentPeriodEnd:
        typeof rawEnd === 'number' ? new Date(rawEnd * 1000).toISOString() : (rawEnd ?? null),
    };
  }

  checkoutUrl(plan: Plan, user: { id: string; email: string }): string {
    const planId = plan === 'yearly' ? this.config.planIdYearly : this.config.planIdMonthly;
    // Metadata ties the Whop membership back to our user id for webhooks.
    const params = new URLSearchParams({ email: user.email, 'metadata[userId]': user.id });
    return `https://whop.com/checkout/${planId}?${params.toString()}`;
  }
}
