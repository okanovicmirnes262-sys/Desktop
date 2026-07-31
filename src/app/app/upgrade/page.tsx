import Link from 'next/link';
import { createClient, getSessionUser } from '@/lib/supabase/server';
import { getSubscription } from '@/lib/db';
import { hasPremium, PRICING } from '@/core/entitlements';
import { getPaymentProvider } from '@/core/payments';
import { VerifyPremiumButton } from '@/components/VerifyPremiumButton';

export default async function UpgradePage() {
  const supabase = await createClient();
  const user = await getSessionUser(supabase);
  if (!user) return null;

  const sub = await getSubscription(supabase, user.id);
  const premium = hasPremium(sub);
  const provider = getPaymentProvider();
  const me = { id: user.id, email: user.email ?? '' };

  if (premium) {
    return (
      <main className="flex flex-col gap-6">
        <h1 className="px-1 text-[26px] font-bold tracking-[-0.01em]">Premium</h1>
        <div className="shadow-card rounded-card bg-card p-8 text-center">
          
          <h2 className="mt-4 text-2xl font-semibold">You&apos;re on Premium</h2>
          <p className="mt-2 text-ink-soft">
            Unlimited routines, full stats and backup are unlocked.
          </p>
        </div>
        <Link href="/app" className="text-center text-ink-soft underline underline-offset-4">
          Back to Today
        </Link>
      </main>
    );
  }

  return (
    <main className="flex flex-col gap-6">
      <header className="px-1">
        <h1 className="text-[26px] font-bold tracking-[-0.01em]">Go Premium</h1>
        <p className="mt-2 text-ink-soft">
          Unlimited routines · full stats · backup
        </p>
      </header>

      <div className="grid grid-cols-1 gap-4">
        <a
          href={provider.checkoutUrl('yearly', me)}
          className="rounded-card bg-primary p-6 text-on-primary transition-transform active:scale-[0.98]"
        >
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-semibold">{PRICING.yearly.label}</span>
            <span className="rounded-full bg-accent px-3 py-1 text-sm font-bold text-accent-ink">
              2 months free
            </span>
          </div>
          <p className="mt-2 text-on-primary/70">Billed once a year via Whop.</p>
        </a>

        <a
          href={provider.checkoutUrl('monthly', me)}
          className="shadow-card rounded-card bg-card p-6 transition-transform active:scale-[0.98]"
        >
          <span className="text-2xl font-semibold">{PRICING.monthly.label}</span>
          <p className="mt-2 text-ink-soft">Cancel anytime via Whop.</p>
        </a>
      </div>

      <VerifyPremiumButton />

      <ul className="shadow-card rounded-card flex flex-col gap-3 bg-card p-6 text-[15px] font-medium">
        <li>✓ Unlimited routines (free plan holds 3)</li>
        <li>✓ Calendar heatmap for every routine</li>
        <li>✓ Completion rate + progress insights</li>
        <li>✓ One-tap backup of all your data</li>
      </ul>
    </main>
  );
}
