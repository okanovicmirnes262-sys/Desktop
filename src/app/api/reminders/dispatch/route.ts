// Reminder dispatcher, hit by cron (Vercel Cron or any external scheduler)
// with `Authorization: Bearer $CRON_SECRET`.
//
// For each routine with a reminder: if the user-local time has passed the
// reminder time today (within a 30-min catch-up window), today is a
// scheduled day, the routine isn't done or resting, and we haven't already
// sent one today → push to every registered device.
//
// All lookups are batched — no per-routine queries.

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
  // No FK between routines and profiles, so no PostgREST embed here —
  // timezones are fetched in a second batched query instead.
  const { data: routines, error } = await db
    .from('routines')
    .select('id, user_id, name, reminder_time, reminder_time_weekend, reminder_times_extra, second_bell, schedule_days')
    .eq('is_archived', false)
    .not('reminder_time', 'is', null);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!routines || routines.length === 0) return NextResponse.json({ ok: true, sent: 0 });

  const userIds = [...new Set(routines.map((r) => r.user_id))];
  const { data: profiles } = await db
    .from('profiles')
    .select('id, timezone')
    .in('id', userIds);
  const tzByUser = new Map((profiles ?? []).map((p) => [p.id, p.timezone as string]));

  // First pass: which reminder slots are due right now (user-local)?
  // slot 0 = main time, 1..2 = premium extras, 9 = second bell (a single
  // repeat ~30 min after the main time when the routine hasn't started).
  const due: {
    id: string; user_id: string; name: string; time: string; today: string; slot: number;
  }[] = [];
  for (const r of routines) {
    const tz = tzByUser.get(r.user_id) ?? 'UTC';
    const today = todayInTz(tz);
    const weekday = weekdayOf(today);
    if (!(r.schedule_days as number[]).includes(weekday)) continue;

    const isWeekend = weekday === 0 || weekday === 6;
    const mainTime = String(
      (isWeekend && r.reminder_time_weekend) || r.reminder_time,
    ).slice(0, 5);
    const nowMin = minutesOfDay(timeInTz(tz));

    const slots: { time: string; slot: number }[] = [{ time: mainTime, slot: 0 }];
    for (const [i, t] of ((r.reminder_times_extra as string[] | null) ?? []).entries()) {
      if (i < 2) slots.push({ time: String(t).slice(0, 5), slot: i + 1 });
    }
    if (r.second_bell) {
      const bellMin = minutesOfDay(mainTime) + 30;
      slots.push({
        time: `${String(Math.floor(bellMin / 60) % 24).padStart(2, '0')}:${String(bellMin % 60).padStart(2, '0')}`,
        slot: 9,
      });
    }
    for (const { time, slot } of slots) {
      const reminderMin = minutesOfDay(time);
      if (nowMin < reminderMin || nowMin > reminderMin + CATCH_UP_MINUTES) continue;
      due.push({ id: r.id, user_id: r.user_id, name: r.name, time, today, slot });
    }
  }
  if (due.length === 0) return NextResponse.json({ ok: true, sent: 0 });

  // Batched exclusions: already completed / resting today.
  const dueIds = due.map((d) => d.id);
  const todays = [...new Set(due.map((d) => d.today))];
  const [{ data: doneRows }, { data: restRows }, { data: subRows }] = await Promise.all([
    db.from('completions').select('routine_id, completed_on').in('routine_id', dueIds).in('completed_on', todays),
    db.from('rest_days').select('routine_id, on_date').in('routine_id', dueIds).in('on_date', todays),
    db.from('push_subscriptions').select('user_id, endpoint, p256dh, auth').in('user_id', [...new Set(due.map((d) => d.user_id))]),
  ]);
  const doneSet = new Set((doneRows ?? []).map((r) => `${r.routine_id}:${r.completed_on}`));
  const restSet = new Set((restRows ?? []).map((r) => `${r.routine_id}:${r.on_date}`));
  const subsByUser = new Map<string, { endpoint: string; p256dh: string; auth: string }[]>();
  for (const s of subRows ?? []) {
    const list = subsByUser.get(s.user_id) ?? [];
    list.push(s);
    subsByUser.set(s.user_id, list);
  }

  let sent = 0;
  for (const d of due) {
    if (doneSet.has(`${d.id}:${d.today}`)) continue;
    if (restSet.has(`${d.id}:${d.today}`)) continue; // resting = not nagged

    // Dedupe: primary key (routine_id, on_date) makes double-sends impossible
    // even with overlapping cron runs.
    const { error: dupe } = await db
      .from('reminder_dispatches')
      .insert({ routine_id: d.id, on_date: d.today, slot: d.slot });
    if (dupe) continue; // this slot already dispatched today

    const copy = reminderCopy(d.name, d.time, `${d.id}-${d.slot}`);
    for (const target of subsByUser.get(d.user_id) ?? []) {
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
