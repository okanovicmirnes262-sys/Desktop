// Premium: CSV export of the completion history (opens in Excel/Sheets).

import { NextResponse } from 'next/server';
import { createClient, getSessionUser } from '@/lib/supabase/server';
import * as db from '@/lib/db';
import { addDays, todayInTz } from '@/core/dates';
import { canUseFeature } from '@/core/entitlements';

export async function GET() {
  const supabase = await createClient();
  const user = await getSessionUser(supabase);
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const sub = await db.getSubscription(supabase, user.id);
  if (!canUseFeature('backup', sub)) {
    return NextResponse.json({ error: 'premium required' }, { status: 402 });
  }

  const [profile, routines] = await Promise.all([
    db.getProfile(supabase, user.id),
    db.listRoutines(supabase, user.id),
  ]);
  const today = todayInTz(profile.timezone);
  const ids = routines.map((r) => r.id);
  const [completionsMap, restMap] = await Promise.all([
    db.listCompletionsBulk(supabase, ids, addDays(today, -365)),
    db.listRestDaysBulk(supabase, ids, addDays(today, -365)),
  ]);

  const esc = (v: string) => `"${v.replaceAll('"', '""')}"`;
  const lines = ['date,routine,event'];
  for (const routine of routines) {
    for (const c of completionsMap.get(routine.id) ?? []) {
      lines.push(`${c.completedOn},${esc(routine.name)},completed`);
    }
    for (const d of restMap.get(routine.id) ?? []) {
      lines.push(`${d},${esc(routine.name)},rest_day`);
    }
  }
  lines.sort();

  return new NextResponse(lines.join('\n') + '\n', {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="tinysteps-history.csv"',
    },
  });
}
