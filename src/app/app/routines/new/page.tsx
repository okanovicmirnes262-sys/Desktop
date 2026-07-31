import Link from 'next/link';
import { ChevronLeft, Lock } from 'lucide-react';
import { createClient, getSessionUser } from '@/lib/supabase/server';
import { getSubscription } from '@/lib/db';
import { hasPremium } from '@/core/entitlements';
import { SEED_ROUTINES } from '@/core/seed';
import { seedTemplateAction } from '@/lib/actions';
import { RoutineForm } from '@/components/RoutineForm';
import { RoutineIcon } from '@/components/icons';

export default async function NewRoutinePage() {
  const supabase = await createClient();
  const user = await getSessionUser(supabase);
  const sub = user ? await getSubscription(supabase, user.id) : null;
  const premium = hasPremium(sub);

  return (
    <main className="flex flex-col gap-6">
      <header className="flex items-center gap-3">
        <Link
          href="/app"
          aria-label="Back"
          className="shadow-card flex h-10 w-10 items-center justify-center rounded-[14px] bg-card text-ink"
        >
          <ChevronLeft size={20} />
        </Link>
        <h1 className="text-2xl font-bold tracking-[-0.01em]">New routine</h1>
      </header>

      <RoutineForm premium={premium} />

      <section className="flex flex-col gap-2 pb-24">
        <p className="ts-label px-1">Or start from a template</p>
        {SEED_ROUTINES.map((t) => {
          const locked = Boolean(t.premium) && !premium;
          const mins = Math.max(
            1,
            Math.round(t.steps.reduce((n, s) => n + (s.timerSeconds ?? 0), 0) / 60),
          );
          const row = (
            <>
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-surface-alt text-primary">
                <RoutineIcon value={t.icon} size={17} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-bold">{t.name}</span>
                <span className="block text-xs text-ink-soft">
                  {t.steps.length} steps · {mins} min
                </span>
              </span>
              {locked ? (
                <span className="flex shrink-0 items-center gap-1 text-xs font-bold text-ink-faint">
                  <Lock size={12} /> Premium
                </span>
              ) : (
                <span className="shrink-0 text-[15px] font-bold text-primary">Use</span>
              )}
            </>
          );
          return locked ? (
            <Link
              key={t.name}
              href="/app/upgrade"
              className="shadow-card flex w-full items-center gap-3 rounded-[20px] bg-card px-4 py-3 opacity-70"
            >
              {row}
            </Link>
          ) : (
            <form key={t.name} action={seedTemplateAction.bind(null, t.name)}>
              <button className="shadow-card flex w-full items-center gap-3 rounded-[20px] bg-card px-4 py-3 text-left">
                {row}
              </button>
            </form>
          );
        })}
      </section>
    </main>
  );
}
