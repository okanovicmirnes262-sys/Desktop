import { Snowflake } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import * as db from '@/lib/db';
import { COMPLETIONS_PER_FREEZE, MAX_FREEZES } from '@/core/streak';
import { RoutineIcon } from '@/components/icons';

// Freezes: what's banked per routine, and the recent earn/spend history.
export default async function FreezesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const routines = await db.listRoutines(supabase, user.id);
  const [streaks, events] = await Promise.all([
    db.getStreaksBulk(supabase, routines.map((r) => r.id)),
    db.listRecentFreezeEvents(supabase, user.id, 15),
  ]);
  const names = new Map(routines.map((r) => [r.id, r.name]));

  return (
    <main className="flex flex-col gap-3.5">
      <header className="px-0.5">
        <h1 className="text-[26px] font-bold tracking-[-0.01em]">Freezes</h1>
        <p className="mt-1 text-[13.5px] leading-relaxed text-ink-soft">
          Every {COMPLETIONS_PER_FREEZE} completions bank a freeze (max {MAX_FREEZES}). A freeze
          quietly covers a missed day so your streak survives.
        </p>
      </header>

      {routines.map((routine) => {
        const streak = streaks.get(routine.id);
        const balance = streak?.freezeBalance ?? 0;
        const progress = streak?.freezeProgress ?? 0;
        return (
          <section key={routine.id} className="shadow-card rounded-card bg-card p-5">
            <div className="flex items-center gap-3">
              <span className="flex h-[42px] w-[42px] items-center justify-center rounded-2xl bg-surface-alt text-primary">
                <RoutineIcon value={routine.emoji} size={19} />
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-[17px] font-bold">{routine.name}</h2>
                <p className="text-xs text-ink-soft">
                  {balance === MAX_FREEZES
                    ? 'Bank full — earning pauses so nothing is wasted'
                    : `${progress} of ${COMPLETIONS_PER_FREEZE} completions toward the next freeze`}
                </p>
              </div>
              <div className="flex shrink-0 gap-1.5">
                {Array.from({ length: MAX_FREEZES }, (_, i) => (
                  <span
                    key={i}
                    className={`flex h-8 w-8 items-center justify-center rounded-xl ${
                      i < balance ? 'bg-primary text-on-primary' : 'bg-surface-alt text-ink-faint'
                    }`}
                  >
                    <Snowflake size={14} strokeWidth={2} />
                  </span>
                ))}
              </div>
            </div>
          </section>
        );
      })}

      {routines.length === 0 && (
        <p className="shadow-card rounded-card bg-card p-6 text-center text-[13.5px] text-ink-soft">
          Freezes show up once you have a routine.
        </p>
      )}

      {events.length > 0 && (
        <section className="shadow-card rounded-card bg-card">
          <p className="ts-label px-5 pt-4">History</p>
          {events.map((e, i) => (
            <div key={`${e.routineId}-${e.onDate}-${e.kind}-${i}`}>
              {i > 0 && <div className="mx-5 h-px bg-line" />}
              <div className="flex items-center gap-3 px-5 py-3">
                <span
                  className={`flex h-8 w-8 items-center justify-center rounded-xl ${
                    e.kind === 'earned' ? 'bg-success-bg text-success' : 'bg-surface-alt text-primary'
                  }`}
                >
                  <Snowflake size={14} strokeWidth={2} />
                </span>
                <span className="flex-1 text-sm font-semibold">
                  {e.kind === 'earned' ? 'Earned' : 'Covered a missed day'} ·{' '}
                  {names.get(e.routineId) ?? 'Routine'}
                </span>
                <span className="text-xs tabular-nums text-ink-faint">{e.onDate}</span>
              </div>
            </div>
          ))}
        </section>
      )}
    </main>
  );
}
