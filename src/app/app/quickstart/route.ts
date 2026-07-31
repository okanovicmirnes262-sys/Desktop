// Home-screen shortcut target: jump straight into the most relevant
// unfinished routine — zero navigation between intention and starting.
import { NextResponse } from 'next/server';
import { createClient, getSessionUser } from '@/lib/supabase/server';
import * as db from '@/lib/db';
import { todayInTz, weekdayOf } from '@/core/dates';

export async function GET(request: Request) {
  const { origin } = new URL(request.url);
  const supabase = await createClient();
  const user = await getSessionUser(supabase);
  if (!user) return NextResponse.redirect(`${origin}/login`);

  const [profile, routines] = await Promise.all([
    db.getProfile(supabase, user.id),
    db.listRoutines(supabase, user.id),
  ]);
  const today = todayInTz(profile.timezone);
  const ids = routines.map((r) => r.id);
  const [completionsMap, restMap] = await Promise.all([
    db.listCompletionsBulk(supabase, ids, today),
    db.listRestDaysBulk(supabase, ids, today),
  ]);

  const next = routines.find(
    (r) =>
      r.scheduleDays.includes(weekdayOf(today)) &&
      (completionsMap.get(r.id) ?? []).length === 0 &&
      !(restMap.get(r.id) ?? new Set()).has(today),
  );

  return NextResponse.redirect(
    next ? `${origin}/app/routines/${next.id}/run` : `${origin}/app`,
  );
}
