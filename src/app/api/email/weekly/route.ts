// Weekly summary dispatcher — hit by cron on Sunday evening (UTC).
// Skips silently when RESEND_API_KEY isn't configured.

import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { addDays, todayInTz, weekdayOf } from '@/core/dates';
import { emailConfigured, sendEmail, weeklySummaryHtml, type WeeklyRow } from '@/lib/email';

export const maxDuration = 60;

export async function GET(request: Request) {
  if (request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  if (!emailConfigured()) {
    return NextResponse.json({ ok: true, skipped: 'RESEND_API_KEY not set' });
  }

  const db = createAdminClient();
  const { data: profiles, error } = await db
    .from('profiles')
    .select('id, display_name, timezone')
    .eq('weekly_email', true);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Map user ids to emails via the auth admin API.
  const emails = new Map<string, string>();
  for (let page = 1; page <= 500; page++) { // no practical cap; stops when a page comes back short
    const { data, error: authErr } = await db.auth.admin.listUsers({ page, perPage: 200 });
    if (authErr || data.users.length === 0) break;
    for (const u of data.users) if (u.email) emails.set(u.id, u.email);
    if (data.users.length < 200) break;
  }

  let sent = 0;
  for (const profile of profiles ?? []) {
    const to = emails.get(profile.id);
    if (!to) continue;

    const today = todayInTz(profile.timezone);
    const weekAgo = addDays(today, -7);

    const { data: routines } = await db
      .from('routines')
      .select('id, name, schedule_days')
      .eq('user_id', profile.id)
      .eq('is_archived', false);
    if (!routines || routines.length === 0) continue;

    const ids = routines.map((r) => r.id);
    const [{ data: completions }, { data: streaks }] = await Promise.all([
      db.from('completions').select('routine_id, completed_on').in('routine_id', ids).gte('completed_on', weekAgo).lt('completed_on', today),
      db.from('streaks').select('routine_id, current_streak').in('routine_id', ids),
    ]);

    const rows: WeeklyRow[] = routines.map((r) => {
      let scheduled = 0;
      for (let i = 1; i <= 7; i++) {
        if ((r.schedule_days as number[]).includes(weekdayOf(addDays(today, -i)))) scheduled++;
      }
      return {
        name: r.name,
        done: (completions ?? []).filter((c) => c.routine_id === r.id).length,
        scheduled,
        currentStreak:
          (streaks ?? []).find((s) => s.routine_id === r.id)?.current_streak ?? 0,
      };
    });

    const ok = await sendEmail(
      to,
      'Your week in tiny steps 🐾',
      weeklySummaryHtml(profile.display_name, rows),
    ).catch(() => false);
    if (ok) sent += 1;
  }

  return NextResponse.json({ ok: true, sent });
}
