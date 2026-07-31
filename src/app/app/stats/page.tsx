import Link from 'next/link';
import { createClient, getSessionUser } from '@/lib/supabase/server';
import * as db from '@/lib/db';
import { addDays, todayInTz } from '@/core/dates';
import { reconcile } from '@/core/streak';
import { completionRate } from '@/core/stats';
import { canUseFeature } from '@/core/entitlements';
import { Heatmap, type DayCell } from '@/components/Heatmap';

// Your progress: two KPIs, then one calm card per routine.
export default async function StatsPage() {
  const supabase = await createClient();
  const user = await getSessionUser(supabase);
  if (!user) return null;

  const [profile, routines, sub] = await Promise.all([
    db.getProfile(supabase, user.id),
    db.listRoutines(supabase, user.id),
    db.getSubscription(supabase, user.id),
  ]);
  const today = todayInTz(profile.timezone);
  const fullStats = canUseFeature('full_stats', sub);
  const since = addDays(today, -60);

  const ids = routines.map((r) => r.id);
  const [streaksMap, completionsMap, restMap] = await Promise.all([
    db.getStreaksBulk(supabase, ids),
    db.listCompletionsBulk(supabase, ids, since),
    db.listRestDaysBulk(supabase, ids, since),
  ]);

  const rows = routines.map((routine) => {
    const stored = streaksMap.get(routine.id) ?? null;
    const completions = completionsMap.get(routine.id) ?? [];
    const restDays = restMap.get(routine.id) ?? new Set<string>();
    const done = new Set(completions.map((c) => c.completedOn));
    const streak = stored ? reconcile(stored, today, restDays).state : null;

    const cells: DayCell[] = [];
    for (let i = 44; i >= 0; i--) {
      const date = addDays(today, -i);
      cells.push({ date, filled: done.has(date) });
    }
    return {
      routine,
      streak,
      cells,
      rate: completionRate(routine, completions, today, 30, restDays),
    };
  });

  const bestCurrent = Math.max(0, ...rows.map((r) => r.streak?.currentStreak ?? 0));
  const rates = rows.map((r) => r.rate).filter((r): r is number => r !== null);
  const avgRate = rates.length ? Math.round((rates.reduce((a, b) => a + b, 0) / rates.length) * 100) : null;
  const showedUp = new Set(
    rows.flatMap((r) => r.cells.filter((c) => c.filled && c.date >= addDays(today, -30)).map((c) => c.date)),
  ).size;

  return (
    <main className="flex flex-col gap-3.5">
      <header className="px-0.5">
        <h1 className="text-[26px] font-bold tracking-[-0.01em]">Your progress</h1>
        <p className="mt-1 text-[13.5px] text-ink-soft">
          Last 30 days · you showed up {showedUp} of them.
        </p>
      </header>

      <div className="grid grid-cols-2 gap-3.5">
        <div
          className="rounded-card bg-primary p-5 text-on-primary"
          style={{ boxShadow: '0 14px 30px rgba(91,87,207,.25)' }}
        >
          <p className="text-[40px] font-extrabold leading-none">{bestCurrent}</p>
          <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.12em] opacity-80">
            Day streak
          </p>
        </div>
        <div className="shadow-card rounded-card bg-card p-5">
          <p className="text-[40px] font-extrabold leading-none">
            {fullStats && avgRate !== null ? `${avgRate}%` : '—'}
          </p>
          <p className="ts-label mt-2">Completion</p>
        </div>
      </div>

      {rows.length === 0 && (
        <p className="shadow-card rounded-card bg-card p-6 text-center text-[13.5px] text-ink-soft">
          Stats show up once you have a routine.
        </p>
      )}

      {rows.map(({ routine, streak, cells }) => (
        <section key={routine.id} className="shadow-card rounded-card bg-card p-5">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="truncate text-[17px] font-bold">{routine.name}</h2>
            <p className="shrink-0 text-xs font-semibold text-ink-faint">
              best {streak?.bestStreak ?? 0}
              {streak && streak.freezeBalance > 0 ? ` · ${streak.freezeBalance} freezes` : ''}
            </p>
          </div>

          <div className="mt-4">
            {fullStats ? (
              <Heatmap cells={cells} />
            ) : (
              <Link
                href="/app/upgrade"
                className="block rounded-2xl border-2 border-dashed p-4 text-center text-xs font-semibold text-ink-faint"
                style={{ borderColor: 'var(--dashed)' }}
              >
                Heatmap + completion rate are Premium →
              </Link>
            )}
          </div>
        </section>
      ))}
    </main>
  );
}
