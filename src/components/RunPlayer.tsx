'use client';

// The routine player — a focused dark screen, one step at a time.
// Header shows routine + step position, segment bars track progress,
// the accent Done button advances, and completion lands on a calm
// milestone-style screen (no confetti, no emoji).

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Snowflake } from 'lucide-react';
import type { Routine, Step } from '@/core/types';
import { TimerRing } from '@/components/TimerRing';
import {
  completeRoutineAction,
  saveRunProgressAction,
  type CompletionCelebration,
} from '@/lib/actions';

export const SOUND_PREF_KEY = 'tinysteps-sound';

/** Soft two-note chime via WebAudio — respects the Settings preference. */
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

const MILESTONE_WORDS: Record<number, string> = {
  7: 'Seven days.',
  30: 'Thirty days.',
  100: 'One hundred days.',
};

function share(text: string) {
  if (navigator.share) {
    navigator.share({ text }).catch(() => undefined);
  } else {
    navigator.clipboard?.writeText(text).catch(() => undefined);
  }
}

export function RunPlayer({
  routine,
  steps,
  initialStepIndex = 0,
  solo = false,
}: {
  routine: Routine;
  steps: Step[];
  initialStepIndex?: number;
  /** "Just one step" mode: celebrate after the first step, then offer more. */
  solo?: boolean;
}) {
  const canResume = initialStepIndex > 0 && initialStepIndex < steps.length;
  const [index, setIndex] = useState(0);
  const [resumePrompt, setResumePrompt] = useState(canResume && !solo);
  const [soloPause, setSoloPause] = useState(false);
  const [running, setRunning] = useState(true);
  const [finishing, setFinishing] = useState(false);
  const [celebration, setCelebration] = useState<CompletionCelebration | null>(null);
  // Routine-level timer keeps running across steps; mounted once.
  const routineTimer = useMemo(() => routine.timerSeconds, [routine.timerSeconds]);

  const step = steps[index];
  const stepHasTimer = Boolean(step?.timerSeconds);

  function goTo(next: number) {
    setIndex(next);
    setRunning(true);
    void saveRunProgressAction(routine.id, next); // fire-and-forget
  }

  async function advance() {
    navigator.vibrate?.(12); // subtle tap feedback where supported
    if (index + 1 < steps.length) {
      goTo(index + 1);
      if (solo && index === 0) setSoloPause(true);
      return;
    }
    setFinishing(true);
    try {
      const result = await completeRoutineAction(routine.id);
      playChime();
      navigator.vibrate?.([30, 40, 30]);
      setCelebration(result);
    } finally {
      setFinishing(false);
    }
  }

  // ---- completion / milestone screen (always the indigo radial) ----------
  if (celebration) {
    const milestone = celebration.milestone;
    const headline = milestone
      ? (MILESTONE_WORDS[milestone] ?? `${milestone} days.`)
      : 'Routine done.';
    return (
      <div className="ts-milestone-screen ts-pop fixed inset-0 z-40 flex flex-col items-center justify-center gap-7 px-[26px] text-center">
        <div
          className="flex h-[200px] w-[200px] items-center justify-center rounded-full"
          style={{ background: 'rgba(255,255,255,0.14)' }}
        >
          <div className="ts-milestone-num flex h-[152px] w-[152px] items-center justify-center rounded-full bg-accent">
            <span className="text-[60px] font-extrabold leading-none text-accent-ink">
              {celebration.currentStreak}
            </span>
          </div>
        </div>

        <div>
          <h1 className="text-[29px] font-bold">{headline}</h1>
          <p className="mx-auto mt-2 max-w-72 text-[13.5px] leading-relaxed text-white/75">
            {milestone
              ? "That's not luck — that's you, showing up. One tiny step at a time."
              : celebration.currentStreak > 1
                ? `${celebration.currentStreak} days in a row${
                    celebration.currentStreak >= celebration.bestStreak ? ' — your best yet.' : '.'
                  }`
                : 'One tiny step at a time.'}
          </p>
        </div>

        {celebration.freezeEarned && (
          <p
            className="flex items-center gap-2 rounded-full px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.12em]"
            style={{ background: 'rgba(255,255,255,0.16)' }}
          >
            <Snowflake size={14} strokeWidth={2} />
            Freeze earned · {celebration.freezeBalance} of 3
          </p>
        )}

        <div className="flex w-full flex-col items-center gap-3">
          <Link
            href="/app"
            className="w-full rounded-[22px] bg-white px-8 py-[18px] text-[17px] font-bold text-[#2a2760] transition-transform active:scale-[0.97]"
          >
            Back to today
          </Link>
          <button
            onClick={() =>
              share(
                `${celebration.currentStreak}-day streak on "${routine.name}" — one tiny step at a time.`,
              )
            }
            className="py-1 text-[13px] font-semibold text-white/70"
          >
            Share this
          </button>
        </div>
      </div>
    );
  }

  // ---- solo-mode interstitial --------------------------------------------
  if (soloPause) {
    return (
      <div className="ts-run-screen ts-pop fixed inset-0 z-40 flex flex-col items-center justify-center gap-7 px-[26px] text-center">
        <div>
          <h1 className="text-[29px] font-bold">That&apos;s a win.</h1>
          <p className="mx-auto mt-2 max-w-72 text-[13.5px] leading-relaxed text-[#a9a5d8]">
            One step done. Sometimes that&apos;s all it takes to get rolling.
          </p>
        </div>
        <div className="flex w-full flex-col items-center gap-3">
          <button
            onClick={() => setSoloPause(false)}
            className="w-full rounded-[22px] bg-accent px-8 py-[18px] text-[17px] font-bold text-[#2a2760] transition-transform active:scale-[0.97]"
          >
            Keep going
          </button>
          <Link href="/app" className="py-1 text-[13px] font-semibold text-white/70">
            Done for now — progress is saved
          </Link>
        </div>
      </div>
    );
  }

  // ---- resume prompt ------------------------------------------------------
  if (resumePrompt) {
    return (
      <div className="ts-run-screen ts-pop fixed inset-0 z-40 flex flex-col items-center justify-center gap-7 px-[26px] text-center">
        <div>
          <h1 className="text-[29px] font-bold">Pick up where you left off?</h1>
          <p className="mt-2 text-[13.5px] text-[#a9a5d8]">
            You were on step {initialStepIndex + 1} of {steps.length}.
          </p>
        </div>
        <div className="flex w-full flex-col items-center gap-3">
          <button
            onClick={() => {
              setIndex(initialStepIndex);
              setResumePrompt(false);
            }}
            className="w-full rounded-[22px] bg-accent px-8 py-[18px] text-[17px] font-bold text-[#2a2760] transition-transform active:scale-[0.97]"
          >
            Continue
          </button>
          <button
            onClick={() => {
              goTo(0);
              setResumePrompt(false);
            }}
            className="py-1 text-[13px] font-semibold text-white/70"
          >
            Start over
          </button>
        </div>
      </div>
    );
  }

  if (!step) {
    return (
      <div className="ts-run-screen fixed inset-0 z-40 flex flex-col items-center justify-center gap-6 px-[26px] text-center">
        <p className="text-[15px] text-[#a9a5d8]">This routine has no steps yet.</p>
        <Link
          href={`/app/routines/${routine.id}`}
          className="rounded-[22px] bg-accent px-8 py-4 font-bold text-[#2a2760]"
        >
          Add steps
        </Link>
      </div>
    );
  }

  // ---- the run screen -----------------------------------------------------
  return (
    <div className="ts-run-screen fixed inset-0 z-40 flex flex-col px-[26px] py-8">
      <header className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.14em] text-[#a9a5d8]">
        <span className="truncate">{routine.name}</span>
        <span className="shrink-0">
          Step {index + 1} of {steps.length}
        </span>
      </header>

      {/* Step segments. */}
      <div className="mt-4 flex gap-1.5" aria-hidden>
        {steps.map((s, i) => (
          <span
            key={s.id}
            className="h-[5px] flex-1 rounded-full"
            style={{ background: i <= index ? 'var(--accent)' : 'rgba(255,255,255,0.18)' }}
          />
        ))}
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-8 text-center">
        {stepHasTimer && (
          // Keyed by step id → each step's timer starts fresh on remount.
          <TimerRing
            key={step.id}
            totalSeconds={step.timerSeconds!}
            running={running}
            onToggle={() => setRunning((r) => !r)}
          />
        )}
        {routineTimer && (
          // Mounted once for the whole run (hidden behind step timers) so
          // it keeps counting across steps instead of resetting.
          <div className={stepHasTimer ? 'hidden' : ''}>
            <TimerRing
              totalSeconds={routineTimer}
              running={running}
              onToggle={() => setRunning((r) => !r)}
            />
          </div>
        )}

        <div key={index} className="ts-step-in">
          <h1 className="text-balance px-2 text-[30px] font-bold leading-tight">{step.title}</h1>
          {(stepHasTimer || routineTimer) && (
            <p className="mt-2 text-[13.5px] text-[#a9a5d8]">
              {running ? 'Running — tap the ring to pause' : 'Paused — tap the ring to resume'}
            </p>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-4 pb-2">
        <button
          onClick={advance}
          disabled={finishing}
          className="w-full rounded-[22px] bg-accent py-[18px] text-[19px] font-bold text-[#2a2760] transition-transform active:scale-[0.97] disabled:opacity-50"
        >
          {finishing ? 'Saving…' : 'Done'}
        </button>
        <div className="flex items-center justify-center gap-7 text-[13px] font-semibold text-white/70">
          {index + 1 < steps.length && (
            <button onClick={() => goTo(index + 1)} className="py-1">
              Skip this step
            </button>
          )}
          <Link href="/app" className="py-1">
            Exit
          </Link>
        </div>
      </div>
    </div>
  );
}
