import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import * as db from '@/lib/db';
import { addDays, todayInTz, weekdayOf } from '@/core/dates';
import { reconcile } from '@/core/streak';
import { canCreateRoutine } from '@/core/entitlements';
import { seedExampleRoutinesAction, skipOnboardingAction } from '@/lib/actions';
import { RestDayButton } from '@/components/RestDayButton';

const COLOR_CLASSES: Record<string, string> = {
  sky: 'bg-sky',
  mint: 'bg-mint',
  blush: 'bg-blush',
  butter: 'bg-butter',
};
const ROTATION = ['bg-sky', 'bg-mint', 'bg-blush', 'bg-butter'];

// Today: the one screen that matters. Each routine is a big card with a
// single primary action — Start.
export default async function TodayPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null; // middleware already guards this

  const [profile, routines, sub] = await Promise.all([
    db.getProfile(supabase, user.id),
    db.listRoutines(supabase, user.id),
    db.getSubscription(supabase, user.id),
  ]);
  const today = todayInTz(profile.timezone);
  const weekStart = addDays(today, -weekdayOf(today)); // Sunday of this week

  // Three bulk queries regardless of routine count — page stays fast.
  const ids = routines.map((r) => r.id);
  const [streaksMap, completionsMap, restMap] = await Promise.all([
    db.getStreaksBulk(supabase, ids),
    db.listCompletionsBulk(supabase, ids, weekStart),
    db.listRestDaysBulk(supabase, ids, addDays(today, -45)),
  ]);

  const cards = routines.map((routine) => {
    const stored = streaksMap.get(routine.id) ?? null;
    const weekCompletions = completionsMap.get(routine.id) ?? [];
    const restDays = restMap.get(routine.id) ?? new Set<string>();
    // Display-time reconcile (pure): freeze spends persist on next completion.
    const streak = stored ? reconcile(stored, today, restDays).state : null;
    return {
      routine,
      streak,
      weekCompletions,
      doneToday: weekCompletions.some((c) => c.completedOn === today),
      restToday: restDays.has(today),
      restDays,
    };
  });

  // Weekly summary: scheduled slots so far this week vs completed, across
  // all routines. Rest days don't count against.
  let weekScheduled = 0;
  let weekDone = 0;
  for (const { routine, weekCompletions, restDays } of cards) {
    const done = new Set(weekCompletions.map((c) => c.completedOn));
    for (let d = weekStart; ; d = addDays(d, 1)) {
      if (routine.scheduleDays.includes(weekdayOf(d)) && !restDays.has(d)) {
        weekScheduled += 1;
        if (done.has(d)) weekDone += 1;
      }
      if (d === today) break;
    }
  }

  const hour = Number(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: profile.timezone,
      hour: 'numeric',
      hourCycle: 'h23',
    }).format(new Date()),
  );
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const atLimit = !canCreateRoutine(routines.length, sub);

  return (
    <main className="flex flex-col gap-5">
      <header className="px-1">
        <h1 className="text-3xl font-semibold tracking-tight">
          {greeting}
          {profile.displayName ? `, ${profile.displayName}` : ''} <span aria-hidden>👋</span>
        </h1>
        <p className="mt-1 text-ink-soft">
          {weekScheduled > 0
            ? `This week: ${weekDone} of ${weekScheduled} done.`
            : 'One tiny step at a time.'}
        </p>
      </header>

      {!profile.onboarded && (
        <div className="rounded-card bg-sky p-6">
          <h2 className="text-xl font-semibold">Start with two ready-made routines?</h2>
          <p className="mt-2 leading-relaxed">
            A gentle Morning routine and a Wind-down routine, built from tiny
            steps. You can change everything later.
          </p>
          <div className="mt-5 flex flex-col gap-3">
            <form action={seedExampleRoutinesAction}>
              <button className="w-full rounded-full bg-ink px-6 py-4 text-lg font-semibold text-on-ink transition-transform active:scale-95">
                Yes, add them
              </button>
            </form>
            <form action={skipOnboardingAction}>
              <button className="w-full rounded-full px-6 py-2 font-medium text-ink/70">
                No thanks, I&apos;ll build my own
              </button>
            </form>
          </div>
        </div>
      )}

      {cards.map(({ routine, streak, doneToday, restToday }, i) => {
        const pastel =
          (routine.color && COLOR_CLASSES[routine.color]) ?? ROTATION[i % ROTATION.length];
        const settled = doneToday || restToday;
        return (
          <div key={routine.id} className={`rounded-card ${settled ? 'bg-card' : pastel} p-6`}>
            <div className="flex items-start justify-between gap-3">
              <Link href={`/app/routines/${routine.id}`} className="min-w-0">
                <p className="text-3xl" aria-hidden>
                  {routine.emoji}
                </p>
                <h2 className="mt-2 truncate text-2xl font-semibold">{routine.name}</h2>
              </Link>
              <div className="flex shrink-0 flex-col items-end gap-1 text-sm font-medium">
                {streak && streak.currentStreak > 0 && (
                  <span className="rounded-full bg-ink px-3 py-1 text-on-ink">
                    🔥 {streak.currentStreak} day{streak.currentStreak === 1 ? '' : 's'}
                  </span>
                )}
                {streak && streak.freezeBalance > 0 && (
                  <span
                    className="rounded-full bg-card px-3 py-1"
                    title="Streak freezes: each one protects a missed day"
                  >
                    🧊 ×{streak.freezeBalance}
                  </span>
                )}
              </div>
            </div>

            {doneToday ? (
              <p className="mt-4 rounded-full bg-mint px-6 py-4 text-center text-lg font-semibold">
                Done today ✓
              </p>
            ) : restToday ? (
              <p className="mt-4 rounded-full bg-butter px-6 py-4 text-center text-lg font-semibold">
                Resting today ☕ — streak is safe
              </p>
            ) : (
              <>
                <Link
                  href={`/app/routines/${routine.id}/run`}
                  className="mt-4 block rounded-full bg-ink px-6 py-4 text-center text-lg font-semibold text-on-ink transition-transform active:scale-95"
                >
                  Start
                </Link>
                <RestDayButton routineId={routine.id} />
              </>
            )}
          </div>
        );
      })}

      {routines.length === 0 && profile.onboarded && (
        <p className="rounded-card bg-card p-6 text-center text-ink-soft">
          No routines yet. Create your first one below.
        </p>
      )}

      {atLimit ? (
        <Link
          href="/app/upgrade"
          className="rounded-card border-2 border-dashed border-line p-5 text-center font-medium text-ink-soft"
        >
          Free plan holds 3 routines — get Premium for unlimited
        </Link>
      ) : (
        <Link
          href="/app/routines/new"
          className="rounded-card border-2 border-dashed border-line p-5 text-center text-lg font-medium text-ink-soft transition-colors hover:border-sky-deep"
        >
          + New routine
        </Link>
      )}
    </main>
  );
}
