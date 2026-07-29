'use client';

// The routine player: exactly one step on screen, one primary action.
// Timers: a step with its own timer gets the big ring; otherwise a
// whole-routine timer (if set) stays visible so time keeps feeling real.

import { useMemo, useState } from 'react';
import Link from 'next/link';
import type { Routine, Step } from '@/core/types';
import { TimerRing } from '@/components/TimerRing';
import { completeRoutineAction, type CompletionCelebration } from '@/lib/actions';

export function RunPlayer({ routine, steps }: { routine: Routine; steps: Step[] }) {
  const [index, setIndex] = useState(0);
  const [finishing, setFinishing] = useState(false);
  const [celebration, setCelebration] = useState<CompletionCelebration | null>(null);
  // Routine-level timer keeps running across steps; mounted once.
  const routineTimer = useMemo(() => routine.timerSeconds, [routine.timerSeconds]);

  const step = steps[index];
  const stepHasTimer = Boolean(step?.timerSeconds);

  async function advance() {
    if (index + 1 < steps.length) {
      setIndex(index + 1);
      return;
    }
    setFinishing(true);
    try {
      setCelebration(await completeRoutineAction(routine.id));
    } finally {
      setFinishing(false);
    }
  }

  if (celebration) {
    return (
      <div className="ts-pop flex flex-1 flex-col items-center justify-center gap-6 text-center">
        <div className="rounded-card w-full bg-mint p-8">
          <p className="text-6xl" aria-hidden>
            🎉
          </p>
          <h1 className="mt-4 text-3xl font-semibold">Routine done</h1>
          <p className="mt-3 text-xl">
            🔥 {celebration.currentStreak}-day streak
            {celebration.currentStreak >= celebration.bestStreak && celebration.currentStreak > 1
              ? ' — your best yet'
              : ''}
          </p>
          {celebration.freezeEarned && (
            <p className="mt-3 rounded-full bg-card px-4 py-2 font-medium">
              🧊 You earned a streak freeze ({celebration.freezeBalance}/3 banked)
            </p>
          )}
        </div>
        <Link
          href="/app"
          className="w-full rounded-full bg-ink px-8 py-5 text-lg font-semibold text-white transition-transform active:scale-95"
        >
          Back to Today
        </Link>
      </div>
    );
  }

  if (!step) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
        <p className="text-lg text-ink-soft">This routine has no steps yet.</p>
        <Link
          href={`/app/routines/${routine.id}`}
          className="rounded-full bg-ink px-8 py-4 font-semibold text-white"
        >
          Add steps
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col">
      {/* Progress dots — where you are without a wall of remaining tasks. */}
      <div className="flex justify-center gap-2 py-4" aria-label={`Step ${index + 1} of ${steps.length}`}>
        {steps.map((s, i) => (
          <span
            key={s.id}
            className={`h-2.5 rounded-full transition-all ${
              i < index ? 'w-2.5 bg-sky-deep' : i === index ? 'w-8 bg-ink' : 'w-2.5 bg-line'
            }`}
          />
        ))}
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-8 text-center">
        {/* Step timer (per-step) or the continuing routine timer. */}
        {stepHasTimer && (
          // Keyed by step id → each step's timer starts fresh on remount.
          <TimerRing key={step.id} totalSeconds={step.timerSeconds!} running />
        )}
        {routineTimer && (
          // Mounted once for the whole run so it keeps counting across steps.
          <div className={stepHasTimer ? 'hidden' : ''}>
            <TimerRing totalSeconds={routineTimer} running />
          </div>
        )}

        <h1 className="text-balance px-2 text-4xl font-semibold leading-tight tracking-tight">
          {step.title}
        </h1>
      </div>

      <div className="flex flex-col gap-3 pb-4">
        <button
          onClick={advance}
          disabled={finishing}
          className="w-full rounded-full bg-ink py-6 text-2xl font-semibold text-white transition-transform active:scale-95 disabled:opacity-50"
        >
          {finishing ? 'Saving…' : index + 1 === steps.length ? 'Done — finish' : 'Done'}
        </button>
        <div className="flex justify-between px-2 text-ink-soft">
          <Link href="/app" className="py-2 underline underline-offset-4">
            Exit
          </Link>
          {index + 1 < steps.length && (
            <button onClick={() => setIndex(index + 1)} className="py-2 underline underline-offset-4">
              Skip this step
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
