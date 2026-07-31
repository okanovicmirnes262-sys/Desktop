'use server';

// Server actions: thin glue between UI and core logic. Business rules live
// in src/core — these functions only authenticate, load, delegate, persist.

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import * as db from '@/lib/db';
import {
  applyCompletion,
  initialStreakState,
  reconcile,
  MILESTONES,
  REST_DAYS_PER_MONTH,
} from '@/core/streak';
import { todayInTz } from '@/core/dates';
import { canCreateRoutine } from '@/core/entitlements';
import { getPaymentProvider } from '@/core/payments';
import { toSubscription } from '@/core/payments/provider';
import { SEED_ROUTINES } from '@/core/seed';

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  return { supabase, user };
}

// ---- routines -------------------------------------------------------------

export async function createRoutineAction(input: {
  name: string;
  emoji: string;
  color: 'sky' | 'mint' | 'blush' | 'butter' | null;
  scheduleDays: number[];
  reminderTime: string | null;
  reminderTimeWeekend: string | null;
  timerSeconds: number | null;
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const { supabase, user } = await requireUser();
  const [routines, sub] = await Promise.all([
    db.listRoutines(supabase, user.id),
    db.getSubscription(supabase, user.id),
  ]);
  if (!canCreateRoutine(routines.length, sub)) {
    return { ok: false, error: 'free_limit' };
  }
  const routine = await db.createRoutine(supabase, user.id, {
    ...input,
    position: routines.length,
  });
  revalidatePath('/app');
  return { ok: true, id: routine.id };
}

export async function updateRoutineAction(
  routineId: string,
  patch: {
    name?: string;
    emoji?: string;
    color?: 'sky' | 'mint' | 'blush' | 'butter' | null;
    scheduleDays?: number[];
    reminderTime?: string | null;
    reminderTimeWeekend?: string | null;
    timerSeconds?: number | null;
  },
) {
  const { supabase } = await requireUser(); // RLS scopes the update to the owner
  await db.updateRoutine(supabase, routineId, patch);
  revalidatePath('/app');
  revalidatePath(`/app/routines/${routineId}`);
}

export async function deleteRoutineAction(routineId: string) {
  const { supabase } = await requireUser();
  await db.deleteRoutine(supabase, routineId);
  revalidatePath('/app');
  redirect('/app');
}

// ---- steps ----------------------------------------------------------------

export async function addStepAction(routineId: string, title: string, timerSeconds: number | null) {
  const { supabase, user } = await requireUser();
  const steps = await db.listSteps(supabase, routineId);
  await db.createStep(supabase, user.id, routineId, {
    title,
    position: steps.length,
    timerSeconds,
  });
  revalidatePath(`/app/routines/${routineId}`);
}

export async function updateStepAction(
  routineId: string,
  stepId: string,
  patch: { title?: string; timerSeconds?: number | null },
) {
  const { supabase } = await requireUser();
  await db.updateStep(supabase, stepId, patch);
  revalidatePath(`/app/routines/${routineId}`);
}

export async function deleteStepAction(routineId: string, stepId: string) {
  const { supabase } = await requireUser();
  await db.deleteStep(supabase, stepId);
  revalidatePath(`/app/routines/${routineId}`);
}

export async function reorderStepsAction(routineId: string, orderedIds: string[]) {
  const { supabase } = await requireUser();
  await db.reorderSteps(supabase, orderedIds);
  revalidatePath(`/app/routines/${routineId}`);
}

// ---- completion + streaks -------------------------------------------------

export interface CompletionCelebration {
  currentStreak: number;
  bestStreak: number;
  freezeEarned: boolean;
  freezeBalance: number;
  /** Set when this completion lands exactly on a milestone (7/30/100). */
  milestone: number | null;
}

/** Called when the user finishes the last step of a run. */
export async function completeRoutineAction(routineId: string): Promise<CompletionCelebration> {
  const { supabase, user } = await requireUser();
  const profile = await db.getProfile(supabase, user.id);
  const today = todayInTz(profile.timezone);

  const stored = (await db.getStreak(supabase, routineId)) ?? initialStreakState(routineId);
  const restDays = new Set(
    await db.listRestDays(supabase, routineId, stored.lastCompletedOn ?? today),
  );
  const { state, events } = applyCompletion(stored, today, restDays);

  await db.insertCompletion(supabase, user.id, routineId, today);
  await db.saveStreak(supabase, user.id, state);
  await db.insertFreezeEvents(supabase, user.id, routineId, events);
  await db.clearRunProgress(supabase, routineId);

  revalidatePath('/app');
  revalidatePath('/app/stats');
  return {
    currentStreak: state.currentStreak,
    bestStreak: state.bestStreak,
    freezeEarned: events.some((e) => e.kind === 'earned'),
    freezeBalance: state.freezeBalance,
    milestone: (MILESTONES as readonly number[]).includes(state.currentStreak)
      ? state.currentStreak
      : null,
  };
}

/** Read-time catch-up: consume freezes / break streaks for elapsed days. */
export async function reconcileStreaksAction() {
  const { supabase, user } = await requireUser();
  const profile = await db.getProfile(supabase, user.id);
  const today = todayInTz(profile.timezone);
  const routines = await db.listRoutines(supabase, user.id);
  for (const routine of routines) {
    const stored = await db.getStreak(supabase, routine.id);
    if (!stored) continue;
    const restDays = new Set(
      await db.listRestDays(supabase, routine.id, stored.lastCompletedOn ?? today),
    );
    const { state, events } = reconcile(stored, today, restDays);
    if (events.length > 0 || state.currentStreak !== stored.currentStreak) {
      await db.saveStreak(supabase, user.id, state);
      await db.insertFreezeEvents(supabase, user.id, routine.id, events);
    }
  }
}

// ---- rest days & run progress --------------------------------------------

/** "Taking today off": protects the streak without spending a freeze. */
export async function takeRestDayAction(
  routineId: string,
): Promise<{ ok: true } | { ok: false; error: 'limit' | 'already_done' }> {
  const { supabase, user } = await requireUser();
  const profile = await db.getProfile(supabase, user.id);
  const today = todayInTz(profile.timezone);

  const doneToday = await db.listCompletions(supabase, routineId, today);
  if (doneToday.length > 0) return { ok: false, error: 'already_done' };

  const used = await db.countRestDaysInMonth(supabase, routineId, today);
  if (used >= REST_DAYS_PER_MONTH) return { ok: false, error: 'limit' };

  await db.addRestDay(supabase, user.id, routineId, today);
  revalidatePath('/app');
  return { ok: true };
}

/** Persist where the user is in today's run so it survives reloads. */
export async function saveRunProgressAction(routineId: string, stepIndex: number) {
  const { supabase, user } = await requireUser();
  const profile = await db.getProfile(supabase, user.id);
  const today = todayInTz(profile.timezone);
  await db.saveRunProgress(supabase, user.id, routineId, today, stepIndex);
}

// ---- onboarding seed ------------------------------------------------------

/** One-tap "Use" on a template row: seeds that single routine. */
export async function seedTemplateAction(templateName: string) {
  const { supabase, user } = await requireUser();
  const seed = SEED_ROUTINES.find((s) => s.name === templateName);
  if (!seed) return;
  const existing = await db.listRoutines(supabase, user.id);
  if (existing.some((r) => r.name === seed.name)) return; // already added
  const routine = await db.createRoutine(supabase, user.id, {
    name: seed.name,
    emoji: seed.icon, // legacy column now stores the icon key
    scheduleDays: seed.scheduleDays,
    reminderTime: seed.reminderTime,
    position: existing.length,
  });
  for (const [j, step] of seed.steps.entries()) {
    await db.createStep(supabase, user.id, routine.id, {
      title: step.title,
      position: j,
      timerSeconds: step.timerSeconds,
    });
  }
  await db.updateProfile(supabase, user.id, { onboarded: true });
  revalidatePath('/app');
}

// ---- profile / settings ---------------------------------------------------

export async function updateTimezoneAction(timezone: string) {
  const { supabase, user } = await requireUser();
  // Validate against Intl before persisting — garbage tz breaks streak days.
  try {
    new Intl.DateTimeFormat('en-CA', { timeZone: timezone });
  } catch {
    return;
  }
  await db.updateProfile(supabase, user.id, { timezone });
}

export async function updateWeeklyEmailAction(enabled: boolean) {
  const { supabase, user } = await requireUser();
  await db.updateProfile(supabase, user.id, { weeklyEmail: enabled });
  revalidatePath('/app/settings');
}

export async function updateThemeAction(theme: string) {
  const { supabase, user } = await requireUser();
  const sub = await db.getSubscription(supabase, user.id);
  const { canUseFeature } = await import('@/core/entitlements');
  if (theme !== 'default' && !canUseFeature('themes', sub)) return;
  await db.updateProfile(supabase, user.id, { theme });
  revalidatePath('/app');
}

export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/login');
}

// ---- premium verification -------------------------------------------------

/** "I've subscribed" button: ask the provider, cache the result. */
export async function verifyPremiumAction(): Promise<{ premium: boolean }> {
  const { user } = await requireUser();
  if (!user.email) return { premium: false };
  const provider = getPaymentProvider();
  const result = await provider.verifyEntitlement({ id: user.id, email: user.email });
  const admin = createAdminClient();
  await db.upsertSubscription(admin, toSubscription(provider, user.id, result));
  revalidatePath('/app');
  return { premium: result.active };
}
