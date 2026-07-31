import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import * as db from '@/lib/db';
import { hasPremium } from '@/core/entitlements';
import { signOutAction } from '@/lib/actions';
import { PushManager } from '@/components/PushManager';
import {
  AppearanceControl,
  SoundToggle,
  TimezoneSync,
  WeeklyEmailToggle,
} from '@/components/SettingsControls';

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [profile, sub, routines] = await Promise.all([
    db.getProfile(supabase, user.id),
    db.getSubscription(supabase, user.id),
    db.listRoutines(supabase, user.id),
  ]);
  const premium = hasPremium(sub);
  const streaks = await db.getStreaksBulk(supabase, routines.map((r) => r.id));
  const banked = [...streaks.values()].reduce((n, s) => n + s.freezeBalance, 0);

  return (
    <main className="flex flex-col gap-3.5">
      <h1 className="px-0.5 text-[26px] font-bold tracking-[-0.01em]">Settings</h1>

      {/* Toggle rows, divided by hairlines. */}
      <section className="shadow-card rounded-card bg-card">
        <div className="flex items-center gap-4 px-5 py-4">
          <div className="min-w-0 flex-1">
            <h2 className="text-[15.5px] font-bold">Reminders</h2>
            <p className="text-xs text-ink-soft">Firm, on-time nudges on this device.</p>
          </div>
          <PushManager />
        </div>
        <div className="mx-5 h-px bg-line" />
        <div className="flex items-center gap-4 px-5 py-4">
          <div className="min-w-0 flex-1">
            <h2 className="text-[15.5px] font-bold">Weekly email</h2>
            <p className="text-xs text-ink-soft">A short Sunday summary of your week.</p>
          </div>
          <WeeklyEmailToggle initial={profile.weeklyEmail} />
        </div>
        <div className="mx-5 h-px bg-line" />
        <div className="flex items-center gap-4 px-5 py-4">
          <div className="min-w-0 flex-1">
            <h2 className="text-[15.5px] font-bold">Celebration sound</h2>
            <p className="text-xs text-ink-soft">A soft chime when you finish a routine.</p>
          </div>
          <SoundToggle />
        </div>
      </section>

      {/* Appearance. */}
      <section className="shadow-card rounded-card bg-card p-5">
        <p className="ts-label mb-3">Appearance</p>
        <AppearanceControl />
      </section>

      {/* Timezone. */}
      <section className="shadow-card rounded-card bg-card p-5">
        <p className="ts-label mb-3">Timezone</p>
        <TimezoneSync current={profile.timezone} />
      </section>

      {/* Navigation rows. */}
      <section className="shadow-card rounded-card bg-card">
        <Link href="/app" className="flex items-center gap-3 px-5 py-4">
          <span className="flex-1 text-[15.5px] font-bold">Your routines</span>
          <span className="text-sm text-ink-soft">{routines.length}</span>
          <ChevronRight size={16} className="text-ink-faint" />
        </Link>
        <div className="mx-5 h-px bg-line" />
        <Link href="/app/freezes" className="flex items-center gap-3 px-5 py-4">
          <span className="flex-1 text-[15.5px] font-bold">Freezes</span>
          <span className="text-sm text-ink-soft">{banked} banked</span>
          <ChevronRight size={16} className="text-ink-faint" />
        </Link>
        <div className="mx-5 h-px bg-line" />
        <Link href={premium ? '/app/upgrade' : '/app/upgrade'} className="flex items-center gap-3 px-5 py-4">
          <span className="flex-1 text-[15.5px] font-bold">Account</span>
          <span className="max-w-40 truncate text-sm text-ink-soft">{user.email}</span>
          <ChevronRight size={16} className="text-ink-faint" />
        </Link>
      </section>

      <section className="shadow-card rounded-card bg-card p-5">
        <p className="text-sm font-semibold">
          Plan: {premium ? 'Premium' : 'Free'}
          {!premium && (
            <>
              {' · '}
              <Link href="/app/upgrade" className="text-primary underline underline-offset-4">
                Upgrade
              </Link>
            </>
          )}
        </p>
        {premium && (
          <a
            href="/api/backup"
            download
            className="mt-3 block rounded-full bg-surface-alt px-5 py-2.5 text-center text-sm font-semibold text-primary"
          >
            Download backup (JSON)
          </a>
        )}
        <form action={signOutAction} className="mt-3">
          <button className="w-full rounded-full bg-surface-tint px-5 py-2.5 text-sm font-semibold text-ink-soft">
            Sign out
          </button>
        </form>
      </section>

      <p className="pb-2 text-center text-[11.5px] text-ink-faint">
        TinySteps · Small steps, kept.
      </p>
    </main>
  );
}
