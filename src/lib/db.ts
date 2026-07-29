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
    position: r.position,
    scheduleDays: r.schedule_days,
    reminderTime: r.reminder_time ? String(r.reminder_time).slice(0, 5) : null,
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
  const { data, error } = await db.from('profiles').select('*').eq('id', userId).single();
  fail(error);
  return {
    id: data.id,
    displayName: data.display_name,
    timezone: data.timezone,
    theme: data.theme,
    onboarded: data.onboarded,
  };
}

export async function updateProfile(
  db: Db,
  userId: string,
  patch: Partial<Pick<Profile, 'displayName' | 'timezone' | 'theme' | 'onboarded'>>,
) {
  const { error } = await db
    .from('profiles')
    .update({
      ...(patch.displayName !== undefined && { display_name: patch.displayName }),
      ...(patch.timezone !== undefined && { timezone: patch.timezone }),
      ...(patch.theme !== undefined && { theme: patch.theme }),
      ...(patch.onboarded !== undefined && { onboarded: patch.onboarded }),
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
    scheduleDays?: number[];
    reminderTime?: string | null;
    timerSeconds?: number | null;
    position?: number;
  },
): Promise<Routine> {
  const { data, error } = await db
    .from('routines')
    .insert({
      user_id: userId,
      name: input.name,
      emoji: input.emoji ?? '✨',
      schedule_days: input.scheduleDays ?? [0, 1, 2, 3, 4, 5, 6],
      reminder_time: input.reminderTime ?? null,
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
  patch: Partial<Pick<Routine, 'name' | 'emoji' | 'scheduleDays' | 'reminderTime' | 'timerSeconds' | 'position' | 'isArchived'>>,
) {
  const { error } = await db
    .from('routines')
    .update({
      ...(patch.name !== undefined && { name: patch.name }),
      ...(patch.emoji !== undefined && { emoji: patch.emoji }),
      ...(patch.scheduleDays !== undefined && { schedule_days: patch.scheduleDays }),
      ...(patch.reminderTime !== undefined && { reminder_time: patch.reminderTime }),
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
