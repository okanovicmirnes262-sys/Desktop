// Reminder dispatcher, hit by Vercel Cron (or any external cron) every
// few minutes with `Authorization: Bearer $CRON_SECRET`.
//
// For each routine with a reminder: if the user-local time has passed the
// reminder time today (within a 30-min catch-up window), today is a
// scheduled day, the routine isn't done yet, and we haven't already sent
// one today → push to every registered device.

import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { minutesOfDay, timeInTz, todayInTz, weekdayOf } from '@/core/dates';
import { reminderCopy, sendPush } from '@/lib/push';

export const maxDuration = 60;

const CATCH_UP_MINUTES = 30; // don't fire reminders that are very stale

export async function GET(request: Request) {
  if (request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const db = createAdminClient();
  const { data: routines, error } = await db
    .from('routines')
    .select('id, user_id, name, reminder_time, reminder_time_weekend, schedule_days, profiles!inner(timezone)')
    .eq('is_archived', false)
    .not('reminder_time', 'is', null);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let sent = 0;
  for (const r of routines ?? []) {
    const tz = (r.profiles as unknown as { timezone: string }).timezone;
    const today = todayInTz(tz);
    const weekday = weekdayOf(today);
    if (!(r.schedule_days as number[]).includes(weekday)) continue;

    // Weekend override: Sat/Sun can have their own reminder time.
    const isWeekend = weekday === 0 || weekday === 6;
    const effectiveTime =
      isWeekend && r.reminder_time_weekend ? r.reminder_time_weekend : r.reminder_time;
    const reminderMin = minutesOfDay(String(effectiveTime).slice(0, 5));
    const nowMin = minutesOfDay(timeInTz(tz));
    if (nowMin < reminderMin || nowMin > reminderMin + CATCH_UP_MINUTES) continue;

    // Skip when already completed today.
    const { data: done } = await db
      .from('completions')
      .select('id')
      .eq('routine_id', r.id)
      .eq('completed_on', today)
      .maybeSingle();
    if (done) continue;

    // Skip declared rest days — resting means not being nagged.
    const { data: resting } = await db
      .from('rest_days')
      .select('on_date')
      .eq('routine_id', r.id)
      .eq('on_date', today)
      .maybeSingle();
    if (resting) continue;

    // Dedupe: primary key (routine_id, on_date) makes double-sends impossible
    // even with overlapping cron runs.
    const { error: dupe } = await db
      .from('reminder_dispatches')
      .insert({ routine_id: r.id, on_date: today });
    if (dupe) continue; // already dispatched today

    const { data: targets } = await db
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth')
      .eq('user_id', r.user_id);

    const copy = reminderCopy(r.name, String(effectiveTime).slice(0, 5));
    for (const target of targets ?? []) {
      const alive = await sendPush(target, copy).catch(() => true); // transient errors: keep sub
      if (!alive) {
        await db.from('push_subscriptions').delete().eq('endpoint', target.endpoint);
      } else {
        sent += 1;
      }
    }
  }

  return NextResponse.json({ ok: true, sent });
}
