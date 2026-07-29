// Provider registry. Server-only (reads secrets). Swap or add providers
// here — feature code stays untouched.

import type { PaymentProvider } from './provider';
import { WhopProvider } from './whop';

let cached: PaymentProvider | null = null;

export function getPaymentProvider(): PaymentProvider {
  if (cached) return cached;
  cached = new WhopProvider({
    apiKey: process.env.WHOP_API_KEY ?? '',
    planIdMonthly: process.env.NEXT_PUBLIC_WHOP_PLAN_ID_MONTHLY ?? '',
    planIdYearly: process.env.NEXT_PUBLIC_WHOP_PLAN_ID_YEARLY ?? '',
  });
  return cached;
}
