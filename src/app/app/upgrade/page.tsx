import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { getSubscription } from '@/lib/db';
import { hasPremium, PRICING } from '@/core/entitlements';
import { getPaymentProvider } from '@/core/payments';
import { VerifyPremiumButton } from '@/components/VerifyPremiumButton';

export default async function UpgradePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const sub = await getSubscription(supabase, user.id);
  const premium = hasPremium(sub);
  const provider = getPaymentProvider();
  const me = { id: user.id, email: user.email ?? '' };

  if (premium) {
    return (
      <main className="flex flex-col gap-6">
        <h1 className="px-1 text-3xl font-semibold tracking-tight">Premium</h1>
        <div className="rounded-card bg-mint p-8 text-center">
          <p className="text-5xl" aria-hidden>💛</p>
          <h2 className="mt-4 text-2xl font-semibold">You&apos;re on Premium</h2>
          <p className="mt-2 text-ink-soft">
            Unlimited routines, themes, full stats and backup are unlocked.
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
        <h1 className="text-3xl font-semibold tracking-tight">Go Premium</h1>
        <p className="mt-2 text-ink-soft">
          Unlimited routines · calm themes · full stats · backup
        </p>
      </header>

      <div className="grid grid-cols-1 gap-4">
        <a
          href={provider.checkoutUrl('yearly', me)}
          className="rounded-card bg-ink p-6 text-on-ink transition-transform active:scale-[0.98]"
        >
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-semibold">{PRICING.yearly.label}</span>
            <span className="rounded-full bg-sky px-3 py-1 text-sm font-semibold text-ink">
              2 months free
            </span>
          </div>
          <p className="mt-2 text-on-ink/70">Billed once a year via Whop.</p>
        </a>

        <a
          href={provider.checkoutUrl('monthly', me)}
          className="rounded-card bg-card p-6 transition-transform active:scale-[0.98]"
        >
          <span className="text-2xl font-semibold">{PRICING.monthly.label}</span>
          <p className="mt-2 text-ink-soft">Cancel anytime via Whop.</p>
        </a>
      </div>

      <VerifyPremiumButton />

      <ul className="rounded-card flex flex-col gap-3 bg-card p-6 text-lg">
        <li>✓ Unlimited routines (free plan holds 3)</li>
        <li>✓ Themes: Dusk & Meadow</li>
        <li>✓ Completion rate + calendar heatmap</li>
        <li>✓ One-tap backup of all your data</li>
      </ul>
    </main>
  );
}
