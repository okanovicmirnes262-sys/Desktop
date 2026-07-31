'use server';

// Server actions: thin glue between UI and core logic. Business rules live
// in src/core — these functions only authenticate, load, delegate, persist.

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient, getSessionUser } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import * as db from '@/lib/db';
import {
  applyCompletion,
  initialStreakState,
  reconcile,
  reconstructStreak,
  MILESTONES,
} from '@/core/streak';
import { addDays, todayInTz } from '@/core/dates';
import { canCreateRoutine, hasPremium, limitsFor } from '@/core/entitlements';
import { getPaymentProvider } from '@/core/payments';
import { toSubscription } from '@/core/payments/provider';
import { SEED_ROUTINES } from '@/core/seed';

async function requireUser() {
  const supabase = await createClient();
  const user = await getSessionUser(supabase); // local JWT check, no network
  if (!user) redirect('/login');
  return { supabase, user };
}

/** Guards actions that take a routineId: RLS hides other users' routines,
 *  so a non-owned id resolves to null → reject before any write. */
async function requireOwnRoutine(
  supabase: Awaited<ReturnType<typeof createClient>>,
  routineId: string,
) {
  const routine = await db.getRoutine(supabase, routineId);
  if (!routine) throw new Error('routine not found');
  return routine;
}

// ---- routines -------------------------------------------------------------

export async function createRoutineAction(input: {
  name: string;
  emoji: string;
  color: 'sky' | 'mint' | 'blush' | 'butter' | null;
  scheduleDays: number[];
  reminderTime: string | null;
  reminderTimeWeekend: string | null;
  reminderTimesExtra: string[];
  secondBell: boolean;
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
  const limits = limitsFor(sub);
  const routine = await db.createRoutine(supabase, user.id, {
    ...input,
    reminderTimesExtra: input.reminderTimesExtra.slice(0, limits.extraReminders),
    secondBell: input.secondBell && limits.extraReminders > 0,
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
    reminderTimesExtra?: string[];
    secondBell?: boolean;
    timerSeconds?: number | null;
  },
) {
  const { supabase, user } = await requireUser(); // RLS scopes the update to the owner
  const sub = await db.getSubscription(supabase, user.id);
  const limits = limitsFor(sub);
  await db.updateRoutine(supabase, routineId, {
    ...patch,
    ...(patch.reminderTimesExtra !== undefined && {
      reminderTimesExtra: patch.reminderTimesExtra.slice(0, limits.extraReminders),
    }),
    ...(patch.secondBell !== undefined && {
      secondBell: patch.secondBell && limits.extraReminders > 0,
    }),
  });
  revalidatePath('/app');
  revalidatePath(`/app/routines/${routineId}`);
}

export async function deleteRoutineAction(routineId: string) {
  const { supabase } = await requireUser();
  await db.deleteRoutine(supabase, routineId);
  revalidatePath('/app');
  revalidatePath('/app/stats');
  revalidatePath('/app/freezes');
  revalidatePath('/app/settings');
  redirect('/app');
}

// ---- steps ----------------------------------------------------------------

export async function addStepAction(routineId: string, title: string, timerSeconds: number | null) {
  const { supabase, user } = await requireUser();
  await requireOwnRoutine(supabase, routineId);
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
  // Ownership check + profile + plan in parallel.
  const [profile, , stored0, sub] = await Promise.all([
    db.getProfile(supabase, user.id),
    requireOwnRoutine(supabase, routineId),
    db.getStreak(supabase, routineId),
    db.getSubscription(supabase, user.id),
  ]);
  const today = todayInTz(profile.timezone);

  const stored = stored0 ?? initialStreakState(routineId);
  const restDays = new Set(
    await db.listRestDays(supabase, routineId, stored.lastCompletedOn ?? today),
  );
  const { state, events } = applyCompletion(stored, today, restDays, limitsFor(sub).streakRules);

  // Independent writes run in parallel — one round trip of latency.
  await Promise.all([
    db.insertCompletion(supabase, user.id, routineId, today),
    db.saveStreak(supabase, user.id, state),
    db.insertFreezeEvents(supabase, user.id, routineId, events),
    db.clearRunProgress(supabase, routineId),
  ]);

  revalidatePath('/app');
  revalidatePath('/app/stats');
  revalidatePath('/app/freezes');
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
  const [profile, , sub] = await Promise.all([
    db.getProfile(supabase, user.id),
    requireOwnRoutine(supabase, routineId),
    db.getSubscription(supabase, user.id),
  ]);
  const today = todayInTz(profile.timezone);

  const doneToday = await db.listCompletions(supabase, routineId, today);
  if (doneToday.length > 0) return { ok: false, error: 'already_done' };

  const used = await db.countRestDaysInMonth(supabase, routineId, today);
  if (used >= limitsFor(sub).restDaysPerMonth) return { ok: false, error: 'limit' };

  await db.addRestDay(supabase, user.id, routineId, today);
  revalidatePath('/app');
  revalidatePath('/app/stats');
  return { ok: true };
}

/** Persist where the user is in today's run so it survives reloads. */
export async function saveRunProgressAction(routineId: string, stepIndex: number) {
  const { supabase, user } = await requireUser();
  const [profile] = await Promise.all([
    db.getProfile(supabase, user.id),
    requireOwnRoutine(supabase, routineId),
  ]);
  const today = todayInTz(profile.timezone);
  await db.saveRunProgress(supabase, user.id, routineId, today, stepIndex);
}

// ---- onboarding seed ------------------------------------------------------

/** One-tap "Use" on a template row: seeds that single routine. */
export async function seedTemplateAction(templateName: string) {
  const { supabase, user } = await requireUser();
  const seed = SEED_ROUTINES.find((s) => s.name === templateName);
  if (!seed) return;
  const [existing, sub] = await Promise.all([
    db.listRoutines(supabase, user.id),
    db.getSubscription(supabase, user.id),
  ]);
  if (seed.premium && !hasPremium(sub)) return; // library is premium
  if (!canCreateRoutine(existing.length, sub)) return;
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
  revalidatePath('/app');
  revalidatePath('/app/settings');
}

export async function updateWeeklyEmailAction(enabled: boolean) {
  const { supabase, user } = await requireUser();
  await db.updateProfile(supabase, user.id, { weeklyEmail: enabled });
  revalidatePath('/app/settings');
}

export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/login');
}

// ---- premium: streak revival ----------------------------------------------

/** Premium: restore a recently broken streak, once per calendar month.
 *  The restored length is reconstructed from real history (completions +
 *  rest days + freeze-covered days). */
export async function reviveStreakAction(
  routineId: string,
): Promise<{ ok: true; restored: number } | { ok: false; error: 'premium' | 'limit' | 'nothing' }> {
  const { supabase, user } = await requireUser();
  const [profile, , sub, stored] = await Promise.all([
    db.getProfile(supabase, user.id),
    requireOwnRoutine(supabase, routineId),
    db.getSubscription(supabase, user.id),
    db.getStreak(supabase, routineId),
  ]);
  if (!hasPremium(sub)) return { ok: false, error: 'premium' };

  const today = todayInTz(profile.timezone);
  const used = await db.countRevivalsInMonth(supabase, user.id, today);
  if (used >= 1) return { ok: false, error: 'limit' }; // 1 revival / month

  const since = addDays(today, -120);
  const [completions, restDays, frozenDays] = await Promise.all([
    db.listCompletions(supabase, routineId, since),
    db.listRestDays(supabase, routineId, since),
    db.listConsumedFreezeDates(supabase, routineId, since),
  ]);
  const completed = new Set(completions.map((c) => c.completedOn));
  if (completed.size === 0) return { ok: false, error: 'nothing' };
  const lastDone = completions[completions.length - 1].completedOn;
  const restored = reconstructStreak(completed, new Set([...restDays, ...frozenDays]), lastDone);
  if (restored === 0) return { ok: false, error: 'nothing' };

  const base = stored ?? initialStreakState(routineId);
  await Promise.all([
    db.saveStreak(supabase, user.id, {
      ...base,
      currentStreak: restored,
      bestStreak: Math.max(base.bestStreak, restored),
      // Alive through yesterday: today's completion continues the streak.
      lastCompletedOn: addDays(today, -1),
    }),
    db.addRevival(supabase, user.id, routineId, today, restored),
  ]);
  revalidatePath('/app');
  revalidatePath('/app/stats');
  revalidatePath('/app/freezes');
  return { ok: true, restored };
}

// ---- premium: accountability partner --------------------------------------

export async function createPartnerInviteAction(): Promise<
  { ok: true; code: string } | { ok: false; error: 'premium' }
> {
  const { supabase, user } = await requireUser();
  const sub = await db.getSubscription(supabase, user.id);
  if (!hasPremium(sub)) return { ok: false, error: 'premium' };
  const existing = await db.getPartnerInvite(supabase, user.id);
  if (existing) return { ok: true, code: existing };
  const code = Array.from({ length: 6 }, () =>
    'ABCDEFGHJKMNPQRSTUVWXYZ23456789'.charAt(Math.floor(Math.random() * 31)),
  ).join('');
  await db.savePartnerInvite(supabase, user.id, code);
  return { ok: true, code };
}

export async function redeemPartnerCodeAction(
  code: string,
): Promise<{ ok: boolean; message: string }> {
  const { supabase, user } = await requireUser();
  const sub = await db.getSubscription(supabase, user.id);
  if (!hasPremium(sub)) return { ok: false, message: 'Partners are a Premium feature.' };
  const { data, error } = await supabase.rpc('redeem_partner_code', {
    invite_code: code.trim().toUpperCase(),
  });
  if (error) return { ok: false, message: 'Something went wrong. Try again.' };
  const result = String(data);
  revalidatePath('/app/settings');
  if (result === 'ok') return { ok: true, message: 'Partner linked!' };
  if (result === 'own_code') return { ok: false, message: "That's your own code." };
  if (result === 'already_partnered')
    return { ok: false, message: 'One of you already has a partner.' };
  return { ok: false, message: 'Invalid code.' };
}

export async function leavePartnershipAction() {
  const { supabase, user } = await requireUser();
  await db.leavePartnership(supabase, user.id);
  revalidatePath('/app/settings');
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
