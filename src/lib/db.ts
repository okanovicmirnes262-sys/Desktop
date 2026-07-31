// Data access: maps snake_case DB rows to the domain types in src/core.
// Every function takes a SupabaseClient so the same code serves server
// components, server actions, and (later) a native app's client.

import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  Completion,
  Profile,
  Routine,
  Step,
  StreakState,
  Subscription,
} from '@/core/types';
import type { FreezeEvent } from '@/core/streak';

/* eslint-disable @typescript-eslint/no-explicit-any */
type Db = SupabaseClient<any, any, any>;

// ---- row mappers ----------------------------------------------------------

function mapRoutine(r: any): Routine {
  return {
    id: r.id,
    userId: r.user_id,
    name: r.name,
    emoji: r.emoji,
    color: r.color ?? null,
    position: r.position,
    scheduleDays: r.schedule_days,
    reminderTime: r.reminder_time ? String(r.reminder_time).slice(0, 5) : null,
    reminderTimeWeekend: r.reminder_time_weekend
      ? String(r.reminder_time_weekend).slice(0, 5)
      : null,
    reminderTimesExtra: (r.reminder_times_extra ?? []).map((t: string) => String(t).slice(0, 5)),
    secondBell: r.second_bell ?? false,
    timerSeconds: r.timer_seconds,
    isArchived: r.is_archived,
  };
}

function mapStep(s: any): Step {
  return {
    id: s.id,
    routineId: s.routine_id,
    title: s.title,
    position: s.position,
    timerSeconds: s.timer_seconds,
  };
}

function mapStreak(s: any): StreakState {
  return {
    routineId: s.routine_id,
    currentStreak: s.current_streak,
    bestStreak: s.best_streak,
    lastCompletedOn: s.last_completed_on,
    freezeBalance: s.freeze_balance,
    freezeProgress: s.freeze_progress,
  };
}

function fail(error: { message: string } | null): asserts error is null {
  if (error) throw new Error(error.message);
}

// ---- profiles -------------------------------------------------------------

export async function getProfile(db: Db, userId: string): Promise<Profile> {
  const { data, error } = await db.from('profiles').select('*').eq('id', userId).maybeSingle();
  fail(error);
  if (!data) {
    // Signup trigger hasn't run (or predates it) — create a default row
    // so every page keeps working, and return sane defaults either way.
    await db.from('profiles').insert({ id: userId }).select().maybeSingle();
    return { id: userId, displayName: null, timezone: 'UTC', theme: 'default', onboarded: false, weeklyEmail: true };
  }
  return {
    id: data.id,
    displayName: data.display_name,
    timezone: data.timezone,
    theme: data.theme,
    onboarded: data.onboarded,
    weeklyEmail: data.weekly_email ?? true,
  };
}

export async function updateProfile(
  db: Db,
  userId: string,
  patch: Partial<Pick<Profile, 'displayName' | 'timezone' | 'theme' | 'onboarded' | 'weeklyEmail'>>,
) {
  const { error } = await db
    .from('profiles')
    .update({
      ...(patch.displayName !== undefined && { display_name: patch.displayName }),
      ...(patch.timezone !== undefined && { timezone: patch.timezone }),
      ...(patch.theme !== undefined && { theme: patch.theme }),
      ...(patch.onboarded !== undefined && { onboarded: patch.onboarded }),
      ...(patch.weeklyEmail !== undefined && { weekly_email: patch.weeklyEmail }),
    })
    .eq('id', userId);
  fail(error);
}

// ---- routines & steps -----------------------------------------------------

export async function listRoutines(db: Db, userId: string): Promise<Routine[]> {
  const { data, error } = await db
    .from('routines')
    .select('*')
    .eq('user_id', userId)
    .eq('is_archived', false)
    .order('position')
    .order('created_at');
  fail(error);
  return data.map(mapRoutine);
}

export async function getRoutine(db: Db, routineId: string): Promise<Routine | null> {
  const { data, error } = await db.from('routines').select('*').eq('id', routineId).maybeSingle();
  fail(error);
  return data ? mapRoutine(data) : null;
}

export async function createRoutine(
  db: Db,
  userId: string,
  input: {
    name: string;
    emoji?: string;
    color?: Routine['color'];
    scheduleDays?: number[];
    reminderTime?: string | null;
    reminderTimeWeekend?: string | null;
    reminderTimesExtra?: string[];
    secondBell?: boolean;
    timerSeconds?: number | null;
    position?: number;
  },
): Promise<Routine> {
  const { data, error } = await db
    .from('routines')
    .insert({
      user_id: userId,
      name: input.name,
      emoji: input.emoji ?? 'sparkles', // icon key (legacy column name)
      color: input.color ?? null,
      schedule_days: input.scheduleDays ?? [0, 1, 2, 3, 4, 5, 6],
      reminder_time: input.reminderTime ?? null,
      reminder_time_weekend: input.reminderTimeWeekend ?? null,
      reminder_times_extra: input.reminderTimesExtra ?? [],
      second_bell: input.secondBell ?? false,
      timer_seconds: input.timerSeconds ?? null,
      position: input.position ?? 0,
    })
    .select()
    .single();
  fail(error);
  // Every routine gets a streak row from day one.
  await db.from('streaks').insert({ routine_id: data.id, user_id: userId });
  return mapRoutine(data);
}

export async function updateRoutine(
  db: Db,
  routineId: string,
  patch: Partial<Pick<Routine, 'name' | 'emoji' | 'color' | 'scheduleDays' | 'reminderTime' | 'reminderTimeWeekend' | 'reminderTimesExtra' | 'secondBell' | 'timerSeconds' | 'position' | 'isArchived'>>,
) {
  const { error } = await db
    .from('routines')
    .update({
      ...(patch.name !== undefined && { name: patch.name }),
      ...(patch.emoji !== undefined && { emoji: patch.emoji }),
      ...(patch.color !== undefined && { color: patch.color }),
      ...(patch.scheduleDays !== undefined && { schedule_days: patch.scheduleDays }),
      ...(patch.reminderTime !== undefined && { reminder_time: patch.reminderTime }),
      ...(patch.reminderTimeWeekend !== undefined && {
        reminder_time_weekend: patch.reminderTimeWeekend,
      }),
      ...(patch.reminderTimesExtra !== undefined && {
        reminder_times_extra: patch.reminderTimesExtra,
      }),
      ...(patch.secondBell !== undefined && { second_bell: patch.secondBell }),
      ...(patch.timerSeconds !== undefined && { timer_seconds: patch.timerSeconds }),
      ...(patch.position !== undefined && { position: patch.position }),
      ...(patch.isArchived !== undefined && { is_archived: patch.isArchived }),
    })
    .eq('id', routineId);
  fail(error);
}

export async function deleteRoutine(db: Db, routineId: string) {
  const { error } = await db.from('routines').delete().eq('id', routineId);
  fail(error);
}

export async function listSteps(db: Db, routineId: string): Promise<Step[]> {
  const { data, error } = await db
    .from('steps')
    .select('*')
    .eq('routine_id', routineId)
    .order('position')
    .order('created_at');
  fail(error);
  return data.map(mapStep);
}

export async function createStep(
  db: Db,
  userId: string,
  routineId: string,
  input: { title: string; position: number; timerSeconds?: number | null },
): Promise<Step> {
  const { data, error } = await db
    .from('steps')
    .insert({
      routine_id: routineId,
      user_id: userId,
      title: input.title,
      position: input.position,
      timer_seconds: input.timerSeconds ?? null,
    })
    .select()
    .single();
  fail(error);
  return mapStep(data);
}

export async function updateStep(
  db: Db,
  stepId: string,
  patch: Partial<Pick<Step, 'title' | 'position' | 'timerSeconds'>>,
) {
  const { error } = await db
    .from('steps')
    .update({
      ...(patch.title !== undefined && { title: patch.title }),
      ...(patch.position !== undefined && { position: patch.position }),
      ...(patch.timerSeconds !== undefined && { timer_seconds: patch.timerSeconds }),
    })
    .eq('id', stepId);
  fail(error);
}

export async function deleteStep(db: Db, stepId: string) {
  const { error } = await db.from('steps').delete().eq('id', stepId);
  fail(error);
}

/** Persist a full ordering in one round trip per changed row. */
export async function reorderSteps(db: Db, orderedIds: string[]) {
  await Promise.all(
    orderedIds.map((id, i) =>
      db.from('steps').update({ position: i }).eq('id', id).then(({ error }) => fail(error)),
    ),
  );
}

// ---- streaks, completions, freezes ---------------------------------------

export async function getStreak(db: Db, routineId: string): Promise<StreakState | null> {
  const { data, error } = await db
    .from('streaks')
    .select('*')
    .eq('routine_id', routineId)
    .maybeSingle();
  fail(error);
  return data ? mapStreak(data) : null;
}

export async function saveStreak(db: Db, userId: string, state: StreakState) {
  const { error } = await db.from('streaks').upsert({
    routine_id: state.routineId,
    user_id: userId,
    current_streak: state.currentStreak,
    best_streak: state.bestStreak,
    last_completed_on: state.lastCompletedOn,
    freeze_balance: state.freezeBalance,
    freeze_progress: state.freezeProgress,
    updated_at: new Date().toISOString(),
  });
  fail(error);
}

export async function insertFreezeEvents(
  db: Db,
  userId: string,
  routineId: string,
  events: FreezeEvent[],
) {
  if (events.length === 0) return;
  const { error } = await db.from('freeze_events').insert(
    events.map((e) => ({
      routine_id: routineId,
      user_id: userId,
      kind: e.kind,
      on_date: e.onDate,
    })),
  );
  fail(error);
}

export async function insertCompletion(
  db: Db,
  userId: string,
  routineId: string,
  completedOn: string,
): Promise<boolean> {
  const { error } = await db
    .from('completions')
    .insert({ routine_id: routineId, user_id: userId, completed_on: completedOn });
  if (error) {
    if (error.code === '23505') return false; // already completed today — fine
    throw new Error(error.message);
  }
  return true;
}

export async function listCompletions(
  db: Db,
  routineId: string,
  sinceDate: string,
): Promise<Completion[]> {
  const { data, error } = await db
    .from('completions')
    .select('id, routine_id, completed_on')
    .eq('routine_id', routineId)
    .gte('completed_on', sinceDate)
    .order('completed_on');
  fail(error);
  return data.map((c: any) => ({
    id: c.id,
    routineId: c.routine_id,
    completedOn: c.completed_on,
  }));
}

// ---- bulk reads (one round trip for N routines — keeps pages fast) -------

export async function getStreaksBulk(
  db: Db,
  routineIds: string[],
): Promise<Map<string, StreakState>> {
  if (routineIds.length === 0) return new Map();
  const { data, error } = await db.from('streaks').select('*').in('routine_id', routineIds);
  fail(error);
  return new Map(data.map((s: any) => [s.routine_id as string, mapStreak(s)]));
}

export async function listCompletionsBulk(
  db: Db,
  routineIds: string[],
  sinceDate: string,
): Promise<Map<string, Completion[]>> {
  const map = new Map<string, Completion[]>(routineIds.map((id) => [id, []]));
  if (routineIds.length === 0) return map;
  const { data, error } = await db
    .from('completions')
    .select('id, routine_id, completed_on, completed_at')
    .in('routine_id', routineIds)
    .gte('completed_on', sinceDate)
    .order('completed_on');
  fail(error);
  for (const c of data) {
    map.get(c.routine_id)?.push({ id: c.id, routineId: c.routine_id, completedOn: c.completed_on, completedAt: c.completed_at });
  }
  return map;
}

export async function listRestDaysBulk(
  db: Db,
  routineIds: string[],
  sinceDate: string,
): Promise<Map<string, Set<string>>> {
  const map = new Map<string, Set<string>>(routineIds.map((id) => [id, new Set()]));
  if (routineIds.length === 0) return map;
  const { data, error } = await db
    .from('rest_days')
    .select('routine_id, on_date')
    .in('routine_id', routineIds)
    .gte('on_date', sinceDate);
  fail(error);
  for (const r of data) map.get(r.routine_id)?.add(r.on_date);
  return map;
}

/** Step counts + total timer seconds per routine, one round trip. */
export async function stepSummaryBulk(
  db: Db,
  routineIds: string[],
): Promise<Map<string, { count: number; totalSeconds: number }>> {
  const map = new Map<string, { count: number; totalSeconds: number }>(
    routineIds.map((id) => [id, { count: 0, totalSeconds: 0 }]),
  );
  if (routineIds.length === 0) return map;
  const { data, error } = await db
    .from('steps')
    .select('routine_id, timer_seconds')
    .in('routine_id', routineIds);
  fail(error);
  for (const s of data) {
    const entry = map.get(s.routine_id);
    if (entry) {
      entry.count += 1;
      entry.totalSeconds += s.timer_seconds ?? 0;
    }
  }
  return map;
}

/** Recent freeze events across all of a user's routines. */
export async function listRecentFreezeEvents(
  db: Db,
  userId: string,
  limit = 20,
): Promise<{ routineId: string; kind: 'earned' | 'consumed'; onDate: string }[]> {
  const { data, error } = await db
    .from('freeze_events')
    .select('routine_id, kind, on_date')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);
  fail(error);
  return data.map((e: any) => ({ routineId: e.routine_id, kind: e.kind, onDate: e.on_date }));
}

// ---- rest days & run progress --------------------------------------------

export async function listRestDays(db: Db, routineId: string, since: string): Promise<string[]> {
  const { data, error } = await db
    .from('rest_days')
    .select('on_date')
    .eq('routine_id', routineId)
    .gte('on_date', since);
  fail(error);
  return data.map((r: any) => r.on_date);
}

/** Rest days already taken for a routine in the month containing `date`. */
export async function countRestDaysInMonth(db: Db, routineId: string, date: string): Promise<number> {
  const monthStart = `${date.slice(0, 7)}-01`;
  const [y, m] = date.split('-').map(Number);
  const nextMonth = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`;
  const { count, error } = await db
    .from('rest_days')
    .select('*', { count: 'exact', head: true })
    .eq('routine_id', routineId)
    .gte('on_date', monthStart)
    .lt('on_date', nextMonth);
  fail(error);
  return count ?? 0;
}

export async function addRestDay(db: Db, userId: string, routineId: string, onDate: string) {
  const { error } = await db
    .from('rest_days')
    .insert({ routine_id: routineId, user_id: userId, on_date: onDate });
  if (error && error.code !== '23505') throw new Error(error.message); // dup = fine
}

export async function getRunProgress(
  db: Db,
  routineId: string,
): Promise<{ onDate: string; stepIndex: number } | null> {
  const { data, error } = await db
    .from('run_progress')
    .select('on_date, step_index')
    .eq('routine_id', routineId)
    .maybeSingle();
  fail(error);
  return data ? { onDate: data.on_date, stepIndex: data.step_index } : null;
}

export async function saveRunProgress(
  db: Db,
  userId: string,
  routineId: string,
  onDate: string,
  stepIndex: number,
) {
  const { error } = await db.from('run_progress').upsert({
    routine_id: routineId,
    user_id: userId,
    on_date: onDate,
    step_index: stepIndex,
    updated_at: new Date().toISOString(),
  });
  fail(error);
}

export async function clearRunProgress(db: Db, routineId: string) {
  const { error } = await db.from('run_progress').delete().eq('routine_id', routineId);
  fail(error);
}

// ---- premium: revivals & partners ----------------------------------------

export async function countRevivalsInMonth(db: Db, userId: string, date: string): Promise<number> {
  const monthStart = `${date.slice(0, 7)}-01`;
  const [y, m] = date.split('-').map(Number);
  const nextMonth = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`;
  const { count, error } = await db
    .from('streak_revivals')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('revived_on', monthStart)
    .lt('revived_on', nextMonth);
  fail(error);
  return count ?? 0;
}

export async function addRevival(
  db: Db,
  userId: string,
  routineId: string,
  revivedOn: string,
  restoredTo: number,
) {
  const { error } = await db.from('streak_revivals').insert({
    user_id: userId,
    routine_id: routineId,
    revived_on: revivedOn,
    restored_to: restoredTo,
  });
  fail(error);
}

/** Freeze-consumed dates for one routine — used to reconstruct a streak. */
export async function listConsumedFreezeDates(
  db: Db,
  routineId: string,
  since: string,
): Promise<string[]> {
  const { data, error } = await db
    .from('freeze_events')
    .select('on_date')
    .eq('routine_id', routineId)
    .eq('kind', 'consumed')
    .gte('on_date', since);
  fail(error);
  return data.map((e: any) => e.on_date);
}

export async function getPartnerInvite(db: Db, userId: string): Promise<string | null> {
  const { data, error } = await db
    .from('partner_invites')
    .select('code')
    .eq('user_id', userId)
    .maybeSingle();
  fail(error);
  return data?.code ?? null;
}

export async function savePartnerInvite(db: Db, userId: string, code: string) {
  const { error } = await db
    .from('partner_invites')
    .upsert({ user_id: userId, code }, { onConflict: 'code' });
  fail(error);
}

export async function getPartnerSummary(
  db: Db,
): Promise<{ displayName: string | null; topStreak: number } | null> {
  const { data, error } = await db.rpc('partner_summary');
  fail(error);
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return null;
  return { displayName: row.display_name ?? null, topStreak: row.top_streak ?? 0 };
}

export async function leavePartnership(db: Db, userId: string) {
  const { error } = await db.from('partnerships').delete().or(`a.eq.${userId},b.eq.${userId}`);
  fail(error);
}

// ---- subscriptions & push -------------------------------------------------

export async function getSubscription(db: Db, userId: string): Promise<Subscription | null> {
  const { data, error } = await db
    .from('subscriptions')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  fail(error);
  if (!data) return null;
  return {
    userId: data.user_id,
    provider: data.provider,
    status: data.status,
    plan: data.plan,
    currentPeriodEnd: data.current_period_end,
  };
}

/** Admin-only: providers write entitlement state here. */
export async function upsertSubscription(db: Db, sub: Subscription) {
  const { error } = await db.from('subscriptions').upsert({
    user_id: sub.userId,
    provider: sub.provider,
    status: sub.status,
    plan: sub.plan,
    current_period_end: sub.currentPeriodEnd,
    updated_at: new Date().toISOString(),
  });
  fail(error);
}

export async function savePushSubscription(
  db: Db,
  userId: string,
  sub: { endpoint: string; keys: { p256dh: string; auth: string } },
) {
  const { error } = await db.from('push_subscriptions').upsert(
    {
      user_id: userId,
      endpoint: sub.endpoint,
      p256dh: sub.keys.p256dh,
      auth: sub.keys.auth,
    },
    { onConflict: 'endpoint' },
  );
  fail(error);
}
