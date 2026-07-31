// Premium: printable progress report (print → save as PDF) — e.g. to
// bring to a therapist or coach. Plain self-contained HTML, no scripts.

import { NextResponse } from 'next/server';
import { createClient, getSessionUser } from '@/lib/supabase/server';
import * as db from '@/lib/db';
import { addDays, todayInTz, weekdayOf } from '@/core/dates';
import { canUseFeature } from '@/core/entitlements';
import { completionRate } from '@/core/stats';

const DAYS = 90;

export async function GET() {
  const supabase = await createClient();
  const user = await getSessionUser(supabase);
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const sub = await db.getSubscription(supabase, user.id);
  if (!canUseFeature('full_stats', sub)) {
    return NextResponse.json({ error: 'premium required' }, { status: 402 });
  }

  const [profile, routines] = await Promise.all([
    db.getProfile(supabase, user.id),
    db.listRoutines(supabase, user.id),
  ]);
  const today = todayInTz(profile.timezone);
  const since = addDays(today, -DAYS);
  const ids = routines.map((r) => r.id);
  const [completionsMap, restMap, streaksMap] = await Promise.all([
    db.listCompletionsBulk(supabase, ids, since),
    db.listRestDaysBulk(supabase, ids, since),
    db.getStreaksBulk(supabase, ids),
  ]);

  const sections = routines
    .map((routine) => {
      const completions = completionsMap.get(routine.id) ?? [];
      const restDays = restMap.get(routine.id) ?? new Set<string>();
      const done = new Set(completions.map((c) => c.completedOn));
      const streak = streaksMap.get(routine.id);
      const rate = completionRate(routine, completions, today, DAYS, restDays);

      let cells = '';
      for (let i = DAYS - 1; i >= 0; i--) {
        const date = addDays(today, -i);
        const scheduled = routine.scheduleDays.includes(weekdayOf(date));
        const bg = done.has(date)
          ? '#5b57cf'
          : restDays.has(date)
            ? '#ffd84d'
            : scheduled
              ? '#e6e4f8'
              : '#f6f5fc';
        cells += `<i title="${date}" style="background:${bg}"></i>`;
      }
      return `
      <section>
        <h2>${routine.name}</h2>
        <p class="meta">
          ${done.size} completions in ${DAYS} days
          ${rate !== null ? ` · ${Math.round(rate * 100)}% of scheduled days` : ''}
          · best streak ${streak?.bestStreak ?? 0} days
        </p>
        <div class="grid">${cells}</div>
      </section>`;
    })
    .join('');

  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<title>TinySteps — progress report</title>
<style>
  body { font-family: system-ui, sans-serif; color: #2a2760; max-width: 720px; margin: 40px auto; padding: 0 24px; }
  h1 { font-size: 24px; margin-bottom: 4px; }
  .sub { color: #6f6ca8; font-size: 13px; margin-bottom: 28px; }
  h2 { font-size: 16px; margin: 24px 0 2px; }
  .meta { color: #6f6ca8; font-size: 12.5px; margin: 0 0 8px; }
  .grid { display: grid; grid-template-columns: repeat(30, 1fr); gap: 3px; }
  .grid i { display: block; aspect-ratio: 1; border-radius: 3px; }
  .legend { margin-top: 28px; font-size: 12px; color: #6f6ca8; }
  .legend i { display: inline-block; width: 10px; height: 10px; border-radius: 3px; margin: 0 4px 0 12px; vertical-align: middle; }
  @media print { body { margin: 0; } }
</style></head><body>
<h1>TinySteps — progress report</h1>
<p class="sub">Last ${DAYS} days · generated for ${profile.displayName ?? user.email ?? 'you'} · consistency over perfection.</p>
${sections || '<p class="meta">No routines yet.</p>'}
<p class="legend">Legend:
  <i style="background:#5b57cf"></i> completed
  <i style="background:#ffd84d"></i> rest day
  <i style="background:#e6e4f8"></i> scheduled, missed
  <i style="background:#f6f5fc"></i> not scheduled
</p>
</body></html>`;

  return new NextResponse(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}
