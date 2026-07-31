import Link from 'next/link';
import { Check, Plus, User } from 'lucide-react';
import { createClient, getSessionUser } from '@/lib/supabase/server';
import * as db from '@/lib/db';
import { addDays, minutesOfDay, timeInTz, todayInTz, weekdayOf } from '@/core/dates';
import { reconcile } from '@/core/streak';
import { canCreateRoutine } from '@/core/entitlements';
import { FREE_TEMPLATES } from '@/core/seed';
import { seedTemplateAction } from '@/lib/actions';
import { RestDayButton } from '@/components/RestDayButton';
import { RoutineIcon } from '@/components/icons';

function metaLine(count: number, totalSeconds: number, reminder: string | null): string {
  const parts = [`${count} tiny step${count === 1 ? '' : 's'}`];
  if (totalSeconds > 0) parts.push(`${Math.max(1, Math.round(totalSeconds / 60))} min`);
  if (reminder) parts.push(reminder);
  return parts.join(' · ');
}

// Today: one focus card for what's next, quiet rows for the rest.
export default async function TodayPage() {
  const supabase = await createClient();
  const user = await getSessionUser(supabase);
  if (!user) return null; // middleware already guards this

  const [profile, routines, sub] = await Promise.all([
    db.getProfile(supabase, user.id),
    db.listRoutines(supabase, user.id),
    db.getSubscription(supabase, user.id),
  ]);
  const today = todayInTz(profile.timezone);
  const weekStart = addDays(today, -weekdayOf(today)); // Sunday of this week

  const ids = routines.map((r) => r.id);
  // 60 days of rest days is enough for any survivable gap (3 freezes +
  // 2 rest days/month); anything older has broken the streak regardless.
  const [streaksMap, completionsMap, restMap, stepsMap] = await Promise.all([
    db.getStreaksBulk(supabase, ids),
    db.listCompletionsBulk(supabase, ids, weekStart),
    db.listRestDaysBulk(supabase, ids, addDays(today, -60)),
    db.stepSummaryBulk(supabase, ids),
  ]);

  const cards = routines.map((routine) => {
    const stored = streaksMap.get(routine.id) ?? null;
    const weekCompletions = completionsMap.get(routine.id) ?? [];
    const restDays = restMap.get(routine.id) ?? new Set<string>();
    const reconciled = stored ? reconcile(stored, today, restDays) : null;
    return {
      routine,
      stored,
      reconciled,
      streak: reconciled?.state ?? null,
      weekCompletions,
      steps: stepsMap.get(routine.id) ?? { count: 0, totalSeconds: 0 },
      doneToday: weekCompletions.some((c) => c.completedOn === today),
      restToday: restDays.has(today),
      restDays,
    };
  });

  // Persist reconciled streaks: freeze spends and breaks for elapsed days
  // land in the DB now, so Freezes/Settings/History never show stale
  // balances. Only routines whose state actually changed are written.
  await Promise.all(
    cards
      .filter(
        (c) =>
          c.stored &&
          c.reconciled &&
          (c.reconciled.events.length > 0 ||
            c.reconciled.state.currentStreak !== c.stored.currentStreak),
      )
      .flatMap((c) => [
        db.saveStreak(supabase, user.id, c.reconciled!.state),
        db.insertFreezeEvents(supabase, user.id, c.routine.id, c.reconciled!.events),
      ]),
  );

  // Weekly summary + progress bar (rest days don't count against).
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
  const weekPct = weekScheduled === 0 ? 0 : Math.round((weekDone / weekScheduled) * 100);

  const nowMin = minutesOfDay(timeInTz(profile.timezone));
  const hour = Math.floor(nowMin / 60);
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const atLimit = !canCreateRoutine(routines.length, sub);

  // Next-due first among the unfinished; done/rest sink to the bottom.
  const open = cards
    .filter((c) => !c.doneToday && !c.restToday)
    .sort((a, b) => {
      const rank = (c: (typeof cards)[number]) => {
        if (!c.routine.reminderTime) return 720;
        const rem = minutesOfDay(c.routine.reminderTime);
        const diff = Math.abs(rem - nowMin);
        return Math.min(diff, 1440 - diff);
      };
      return rank(a) - rank(b);
    });
  const settled = cards.filter((c) => c.doneToday || c.restToday);
  const [focus, ...upcoming] = open;

  return (
    <main className="flex flex-col gap-3.5">
      <header className="flex items-start justify-between gap-3 px-0.5">
        <div>
          <h1 className="text-[26px] font-bold leading-tight tracking-[-0.01em]">
            {greeting}
            {profile.displayName ? `, ${profile.displayName}` : ''}
          </h1>
          <p className="mt-1 text-[13.5px] leading-relaxed text-ink-soft">
            {weekScheduled > 0
              ? `${weekDone} of ${weekScheduled} done this week — nice pace.`
              : "Let's start with one small thing."}
          </p>
        </div>
        <Link
          href="/app/settings"
          aria-label="Profile & settings"
          className="shadow-card flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-card text-primary"
        >
          <User size={19} strokeWidth={2} />
        </Link>
      </header>

      {weekScheduled > 0 && (
        <div className="h-2 w-full rounded-full bg-track" role="progressbar" aria-valuenow={weekPct} aria-valuemin={0} aria-valuemax={100}>
          <div
            className="h-2 rounded-full bg-primary transition-[width] duration-400"
            style={{ width: `${weekPct}%` }}
          />
        </div>
      )}

      {/* Focus card: the one next-due routine. */}
      {focus && (
        <section className="shadow-focus rounded-card-lg bg-card p-6">
          <div className="flex items-center gap-4">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-surface-alt text-primary">
              <RoutineIcon value={focus.routine.emoji} size={22} />
            </span>
            <div className="min-w-0">
              <h2 className="truncate text-xl font-bold leading-tight">
                {focus.routine.name}
                {focus.streak && focus.streak.currentStreak > 0 && (
                  <span className="ml-2 align-middle text-xs font-semibold text-ink-faint">
                    {focus.streak.currentStreak}
                  </span>
                )}
              </h2>
              <p className="mt-0.5 truncate text-[13.5px] text-ink-soft">
                {metaLine(focus.steps.count, focus.steps.totalSeconds, focus.routine.reminderTime)}
              </p>
            </div>
          </div>
          <Link
            href={`/app/routines/${focus.routine.id}/run`}
            className="mt-5 block rounded-[20px] bg-primary px-6 py-4 text-center text-[17px] font-bold text-on-primary transition-colors hover:bg-primary-hover active:scale-[0.98]"
          >
            Start
          </Link>
          <div className="mt-2 flex items-center justify-center gap-6">
            <Link
              href={`/app/routines/${focus.routine.id}/run?solo=1`}
              className="py-1.5 text-xs font-semibold text-ink-faint"
            >
              Just one step
            </Link>
            <RestDayButton routineId={focus.routine.id} />
          </div>
        </section>
      )}

      {/* Upcoming routines: quiet rows with a Start text button. */}
      {upcoming.map(({ routine, steps }) => {
        return (
          <section key={routine.id} className="shadow-card rounded-card flex items-center gap-4 bg-card px-5 py-4">
            <span className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-2xl bg-surface-alt text-primary">
              <RoutineIcon value={routine.emoji} size={19} />
            </span>
            <Link href={`/app/routines/${routine.id}`} className="min-w-0 flex-1">
              <h2 className="truncate text-[17px] font-bold leading-tight">{routine.name}</h2>
              <p className="truncate text-xs text-ink-soft">
                {metaLine(steps.count, steps.totalSeconds, routine.reminderTime)}
              </p>
            </Link>
            <Link
              href={`/app/routines/${routine.id}/run`}
              className="shrink-0 px-2 py-2 text-[15px] font-bold text-primary"
            >
              Start
            </Link>
          </section>
        );
      })}

      {/* Done / resting rows. */}
      {settled.map(({ routine, doneToday }) => {
        return (
          <section
            key={routine.id}
            className="shadow-card rounded-card flex items-center gap-4 bg-card px-5 py-4 opacity-75"
          >
            <span
              className={`flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-2xl ${
                doneToday ? 'bg-success-bg text-success' : 'bg-surface-alt text-ink-faint'
              }`}
            >
              {doneToday ? <Check size={20} strokeWidth={2.5} /> : <RoutineIcon value={routine.emoji} size={19} />}
            </span>
            <Link href={`/app/routines/${routine.id}`} className="min-w-0 flex-1">
              <h2 className="truncate text-[17px] font-bold leading-tight">{routine.name}</h2>
              <p className="text-xs text-ink-soft">
                {doneToday ? 'Done today' : 'Resting today — streak is safe'}
              </p>
            </Link>
          </section>
        );
      })}

      {/* Empty state / first run. */}
      {routines.length === 0 && (
        <>
          <section className="shadow-focus rounded-card-lg bg-card px-6 py-8 text-center">
            <span className="mx-auto flex h-[88px] w-[88px] items-center justify-center rounded-[30px] bg-surface-alt text-primary">
              <Plus size={38} strokeWidth={2} />
            </span>
            <h2 className="mt-5 text-[21px] font-bold">No routines yet</h2>
            <p className="mx-auto mt-2 max-w-72 text-[13.5px] leading-relaxed text-ink-soft">
              A routine is just a few tiny steps in a row. Two minutes is a
              perfectly good start.
            </p>
            <Link
              href="/app/routines/new"
              className="mt-5 block rounded-[20px] bg-primary px-6 py-4 text-center text-[17px] font-bold text-on-primary"
            >
              Add your first routine
            </Link>
          </section>

          <p className="ts-label mt-3 px-1">Or start from a template</p>
          {FREE_TEMPLATES.map((seed) => {
            const mins = Math.max(
              1,
              Math.round(seed.steps.reduce((n, s) => n + (s.timerSeconds ?? 0), 0) / 60),
            );
            return (
              <form key={seed.name} action={seedTemplateAction.bind(null, seed.name)}>
                <button className="shadow-card flex w-full items-center gap-3 rounded-[20px] bg-card px-4 py-3 text-left">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-surface-alt text-primary">
                    <RoutineIcon value={seed.icon} size={17} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-bold">{seed.name}</span>
                    <span className="block text-xs text-ink-soft">
                      {seed.steps.length} steps · {mins} min
                    </span>
                  </span>
                  <span className="shrink-0 text-[15px] font-bold text-primary">Use</span>
                </button>
              </form>
            );
          })}
        </>
      )}

      {/* Add a routine — dashed card. */}
      {routines.length > 0 &&
        (atLimit ? (
          <Link
            href="/app/upgrade"
            className="rounded-card border-2 border-dashed p-5 text-center text-sm font-semibold text-ink-faint"
            style={{ borderColor: 'var(--dashed)' }}
          >
            Free plan holds 3 routines — Premium removes the limit
          </Link>
        ) : (
          <Link
            href="/app/routines/new"
            className="rounded-card flex items-center justify-center gap-3 border-2 border-dashed p-5"
            style={{ borderColor: 'var(--dashed)' }}
          >
            <span className="flex h-[34px] w-[34px] items-center justify-center rounded-xl bg-accent text-accent-ink">
              <Plus size={18} strokeWidth={2.5} />
            </span>
            <span className="text-sm font-bold text-primary">Add a routine</span>
          </Link>
        ))}
    </main>
  );
}
