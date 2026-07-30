'use client';

// The routine player: exactly one step on screen, one primary action.
// Timers: a step with its own timer gets the big ring; otherwise a
// whole-routine timer (if set) stays visible so time keeps feeling real.
// Progress persists server-side after every step, so a half-done routine
// can resume after a reload or on another device.

import { useMemo, useState } from 'react';
import Link from 'next/link';
import type { Routine, Step } from '@/core/types';
import { TimerRing } from '@/components/TimerRing';
import {
  completeRoutineAction,
  saveRunProgressAction,
  type CompletionCelebration,
} from '@/lib/actions';

export const SOUND_PREF_KEY = 'tinysteps-sound';

/** Soft two-note chime via WebAudio — no asset files, respects the
 *  user's sound preference (Settings). */
function playChime() {
  try {
    if (localStorage.getItem(SOUND_PREF_KEY) === 'off') return;
    const ctx = new AudioContext();
    [523.25, 783.99].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const t = ctx.currentTime + i * 0.18;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.12, t + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.8);
    });
  } catch {
    // audio blocked or unsupported — silently fine
  }
}

const CONFETTI_COLORS = ['var(--sky-deep)', 'var(--mint)', 'var(--blush)', 'var(--butter)'];

/** Deterministic 0–1 "random" so rendering stays pure (React lint rule). */
function pseudoRandom(seed: number) {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

function Confetti() {
  // Deterministic scatter; reduced-motion users get none (CSS kills it).
  const pieces = useMemo(
    () =>
      Array.from({ length: 28 }, (_, i) => ({
        left: `${pseudoRandom(i + 1) * 100}%`,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        delay: `${pseudoRandom(i + 100) * 0.6}s`,
        duration: `${2 + pseudoRandom(i + 200) * 1.6}s`,
      })),
    [],
  );
  return (
    <div aria-hidden>
      {pieces.map((p, i) => (
        <span
          key={i}
          className="ts-confetti-piece"
          style={{
            left: p.left,
            background: p.color,
            ['--fall-delay' as string]: p.delay,
            ['--fall-duration' as string]: p.duration,
          }}
        />
      ))}
    </div>
  );
}

export function RunPlayer({
  routine,
  steps,
  initialStepIndex = 0,
}: {
  routine: Routine;
  steps: Step[];
  initialStepIndex?: number;
}) {
  const canResume = initialStepIndex > 0 && initialStepIndex < steps.length;
  const [index, setIndex] = useState(0);
  const [resumePrompt, setResumePrompt] = useState(canResume);
  const [finishing, setFinishing] = useState(false);
  const [celebration, setCelebration] = useState<CompletionCelebration | null>(null);
  // Routine-level timer keeps running across steps; mounted once.
  const routineTimer = useMemo(() => routine.timerSeconds, [routine.timerSeconds]);

  const step = steps[index];
  const stepHasTimer = Boolean(step?.timerSeconds);

  function goTo(next: number) {
    setIndex(next);
    void saveRunProgressAction(routine.id, next); // fire-and-forget
  }

  async function advance() {
    if (index + 1 < steps.length) {
      goTo(index + 1);
      return;
    }
    setFinishing(true);
    try {
      const result = await completeRoutineAction(routine.id);
      playChime();
      setCelebration(result);
    } finally {
      setFinishing(false);
    }
  }

  if (celebration) {
    return (
      <div className="ts-pop flex flex-1 flex-col items-center justify-center gap-6 text-center">
        <Confetti />
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
          className="w-full rounded-full bg-ink px-8 py-5 text-lg font-semibold text-on-ink transition-transform active:scale-95"
        >
          Back to Today
        </Link>
      </div>
    );
  }

  if (resumePrompt) {
    return (
      <div className="ts-pop flex flex-1 flex-col items-center justify-center gap-6 text-center">
        <div className="rounded-card w-full bg-sky p-8">
          <p className="text-5xl" aria-hidden>
            👣
          </p>
          <h1 className="mt-4 text-2xl font-semibold">Pick up where you left off?</h1>
          <p className="mt-2">
            You were on step {initialStepIndex + 1} of {steps.length}.
          </p>
        </div>
        <button
          onClick={() => {
            setIndex(initialStepIndex);
            setResumePrompt(false);
          }}
          className="w-full rounded-full bg-ink px-8 py-5 text-lg font-semibold text-on-ink transition-transform active:scale-95"
        >
          Continue
        </button>
        <button
          onClick={() => {
            goTo(0);
            setResumePrompt(false);
          }}
          className="py-2 text-ink-soft underline underline-offset-4"
        >
          Start over
        </button>
      </div>
    );
  }

  if (!step) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
        <p className="text-lg text-ink-soft">This routine has no steps yet.</p>
        <Link
          href={`/app/routines/${routine.id}`}
          className="rounded-full bg-ink px-8 py-4 font-semibold text-on-ink"
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
          className="w-full rounded-full bg-ink py-6 text-2xl font-semibold text-on-ink transition-transform active:scale-95 disabled:opacity-50"
        >
          {finishing ? 'Saving…' : index + 1 === steps.length ? 'Done — finish' : 'Done'}
        </button>
        <div className="flex justify-between px-2 text-ink-soft">
          <Link href="/app" className="py-2 underline underline-offset-4">
            Exit
          </Link>
          {index + 1 < steps.length && (
            <button onClick={() => goTo(index + 1)} className="py-2 underline underline-offset-4">
              Skip this step
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
