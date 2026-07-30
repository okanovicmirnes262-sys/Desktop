import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { getProfile, getSubscription } from '@/lib/db';
import { hasPremium } from '@/core/entitlements';
import { signOutAction } from '@/lib/actions';
import { PushManager } from '@/components/PushManager';
import { SoundToggle, ThemePicker, TimezoneSync } from '@/components/SettingsControls';

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [profile, sub] = await Promise.all([
    getProfile(supabase, user.id),
    getSubscription(supabase, user.id),
  ]);
  const premium = hasPremium(sub);

  return (
    <main className="flex flex-col gap-6">
      <h1 className="px-1 text-3xl font-semibold tracking-tight">Settings</h1>

      <section className="rounded-card bg-card p-6">
        <h2 className="text-lg font-semibold">Reminders</h2>
        <p className="mb-4 mt-1 text-sm text-ink-soft">
          Firm, on-time nudges for routines with a reminder time set.
        </p>
        <PushManager />
      </section>

      <section className="rounded-card bg-card p-6">
        <h2 className="text-lg font-semibold">Celebration sound</h2>
        <p className="mb-4 mt-1 text-sm text-ink-soft">
          A soft chime when you finish a routine. This device only.
        </p>
        <SoundToggle />
      </section>

      <section className="rounded-card bg-card p-6">
        <h2 className="mb-3 text-lg font-semibold">Timezone</h2>
        <TimezoneSync current={profile.timezone} />
      </section>

      <section className="rounded-card bg-card p-6">
        <h2 className="mb-3 text-lg font-semibold">Theme</h2>
        <ThemePicker current={profile.theme} premium={premium} />
        {!premium && (
          <p className="mt-3 text-sm text-ink-soft">
            Themes are part of{' '}
            <Link href="/app/upgrade" className="underline underline-offset-4">
              Premium
            </Link>
            .
          </p>
        )}
      </section>

      <section className="rounded-card bg-card p-6">
        <h2 className="text-lg font-semibold">Account</h2>
        <p className="mt-1 text-sm text-ink-soft">{user.email}</p>
        <p className="mt-1 text-sm font-medium">
          Plan: {premium ? 'Premium 💛' : 'Free'}
          {!premium && (
            <>
              {' · '}
              <Link href="/app/upgrade" className="underline underline-offset-4">
                Upgrade
              </Link>
            </>
          )}
        </p>
        {premium && (
          <a
            href="/api/backup"
            download
            className="mt-4 block rounded-full border border-line px-6 py-3 text-center font-semibold"
          >
            Download backup (JSON)
          </a>
        )}
        <form action={signOutAction} className="mt-4">
          <button className="w-full rounded-full bg-paper px-6 py-3 font-semibold text-ink-soft">
            Sign out
          </button>
        </form>
      </section>
    </main>
  );
}
