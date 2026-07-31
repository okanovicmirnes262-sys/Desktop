import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import * as db from '@/lib/db';
import { addDays, todayInTz } from '@/core/dates';
import { reconcile } from '@/core/streak';
import { completionRate, heatmapData } from '@/core/stats';
import { canUseFeature } from '@/core/entitlements';
import { Heatmap } from '@/components/Heatmap';

const BADGES = [
  { at: 7, emoji: '🥉', label: '7-day streak' },
  { at: 30, emoji: '🥈', label: '30-day streak' },
  { at: 100, emoji: '🏆', label: '100-day streak' },
];

// Stats, deliberately small: streaks for everyone; rate + heatmap are
// premium ("full stats"). All gating flows through canUseFeature/hasPremium.
export default async function StatsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [profile, routines, sub] = await Promise.all([
    db.getProfile(supabase, user.id),
    db.listRoutines(supabase, user.id),
    db.getSubscription(supabase, user.id),
  ]);
  const today = todayInTz(profile.timezone);
  const fullStats = canUseFeature('full_stats', sub);
  const since = addDays(today, -120); // enough history for the heatmap

  // Bulk queries: 3 round trips total instead of 3 per routine.
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
    const streak = stored ? reconcile(stored, today, restDays).state : null;
    return {
      routine,
      streak,
      rate: completionRate(routine, completions, today, 30, restDays),
      heatmap: heatmapData(routine, completions, today, 15, restDays),
    };
  });

  return (
    <main className="flex flex-col gap-5">
      <h1 className="px-1 text-3xl font-semibold tracking-tight">Stats</h1>

      {rows.length === 0 && (
        <p className="rounded-card bg-card p-6 text-center text-ink-soft">
          Stats show up once you have a routine.
        </p>
      )}

      {rows.map(({ routine, streak, rate, heatmap }) => (
        <section key={routine.id} className="rounded-card bg-card p-6">
          <h2 className="text-xl font-semibold">
            {routine.emoji} {routine.name}
          </h2>

          <div className="mt-4 grid grid-cols-3 gap-3 text-center">
            <div className="rounded-2xl bg-sky p-3">
              <p className="text-2xl font-semibold tabular-nums">{streak?.currentStreak ?? 0}</p>
              <p className="text-xs font-medium text-ink/70">Current streak</p>
            </div>
            <div className="rounded-2xl bg-mint p-3">
              <p className="text-2xl font-semibold tabular-nums">{streak?.bestStreak ?? 0}</p>
              <p className="text-xs font-medium text-ink/70">Best streak</p>
            </div>
            <div className="rounded-2xl bg-butter p-3">
              <p className="text-2xl font-semibold tabular-nums">
                {fullStats && rate !== null ? `${Math.round(rate * 100)}%` : '—'}
              </p>
              <p className="text-xs font-medium text-ink/70">30-day rate</p>
            </div>
          </div>

          {/* Milestone badges — earned once via best streak, kept forever. */}
          {streak && streak.bestStreak >= BADGES[0].at && (
            <div className="mt-3 flex flex-wrap gap-2">
              {BADGES.filter((b) => streak.bestStreak >= b.at).map((b) => (
                <span
                  key={b.at}
                  className="rounded-full bg-paper px-3 py-1 text-sm font-medium"
                  title={b.label}
                >
                  {b.emoji} {b.label}
                </span>
              ))}
            </div>
          )}

          {streak && streak.freezeBalance > 0 && (
            <p className="mt-3 text-sm text-ink-soft">
              🧊 {streak.freezeBalance} streak freeze{streak.freezeBalance === 1 ? '' : 's'} banked —
              each protects one missed day.
            </p>
          )}

          <div className="mt-5">
            {fullStats ? (
              <Heatmap columns={heatmap} />
            ) : (
              <Link
                href="/app/upgrade"
                className="block rounded-2xl border-2 border-dashed border-line p-4 text-center text-sm font-medium text-ink-soft"
              >
                Calendar heatmap + completion rate are Premium →
              </Link>
            )}
          </div>
        </section>
      ))}
    </main>
  );
}
