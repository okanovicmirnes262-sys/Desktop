'use client';

// Step list editor: add, rename, delete, reorder. Reordering uses big
// up/down buttons instead of drag-and-drop — reliable, accessible, and
// works identically on touch.

import { useState, useTransition } from 'react';
import { ChevronDown, ChevronUp, Timer, X } from 'lucide-react';
import type { Step } from '@/core/types';
import {
  addStepAction,
  deleteStepAction,
  reorderStepsAction,
  updateStepAction,
} from '@/lib/actions';

export function StepEditor({ routineId, steps }: { routineId: string; steps: Step[] }) {
  const [newTitle, setNewTitle] = useState('');
  const [newTimer, setNewTimer] = useState('');
  const [pending, startTransition] = useTransition();

  // Local optimistic ordering so two quick taps don't both compute from
  // the same stale server order. Re-synced when fresh props arrive.
  const [localSteps, setLocalSteps] = useState(steps);
  const [prevSteps, setPrevSteps] = useState(steps);
  if (steps !== prevSteps) {
    setPrevSteps(steps);
    setLocalSteps(steps);
  }

  function move(index: number, dir: -1 | 1) {
    const target = index + dir;
    if (target < 0 || target >= localSteps.length) return;
    const next = [...localSteps];
    [next[index], next[target]] = [next[target], next[index]];
    setLocalSteps(next);
    startTransition(() => reorderStepsAction(routineId, next.map((s) => s.id)));
  }

  function add(e: React.FormEvent) {
    e.preventDefault();
    const title = newTitle.trim();
    if (!title) return;
    const timer = newTimer ? Number(newTimer) * 60 : null;
    setNewTitle('');
    setNewTimer('');
    startTransition(() => addStepAction(routineId, title, timer));
  }

  return (
    <section aria-label="Steps" className="flex flex-col gap-3">
      <p className="ts-label px-1">Steps — small enough that starting feels easy</p>

      <ol className="flex flex-col gap-2">
        {localSteps.map((step, i) => (
          <li key={step.id} className="shadow-card flex items-center gap-2 rounded-[20px] bg-card p-3">
            <div className="flex flex-col">
              <button
                aria-label={`Move "${step.title}" up`}
                disabled={i === 0 || pending}
                onClick={() => move(i, -1)}
                className="flex h-8 w-10 items-center justify-center rounded-lg text-ink-faint disabled:opacity-25"
              >
                <ChevronUp size={18} />
              </button>
              <button
                aria-label={`Move "${step.title}" down`}
                disabled={i === localSteps.length - 1 || pending}
                onClick={() => move(i, 1)}
                className="flex h-8 w-10 items-center justify-center rounded-lg text-ink-faint disabled:opacity-25"
              >
                <ChevronDown size={18} />
              </button>
            </div>

            <input
              defaultValue={step.title}
              maxLength={120}
              aria-label={`Step ${i + 1} title`}
              onBlur={(e) => {
                const title = e.target.value.trim();
                if (title && title !== step.title) {
                  startTransition(() => updateStepAction(routineId, step.id, { title }));
                }
              }}
              className="min-w-0 flex-1 rounded-xl bg-transparent px-2 py-2 text-[15.5px] font-semibold outline-none focus:bg-surface-tint"
            />

            {step.timerSeconds ? (
              <span className="flex shrink-0 items-center gap-1 rounded-full bg-surface-alt px-2.5 py-1 text-xs font-semibold text-primary">
                <Timer size={12} strokeWidth={2} />
                {Math.round(step.timerSeconds / 60)}m
              </span>
            ) : null}

            <button
              aria-label={`Delete "${step.title}"`}
              disabled={pending}
              onClick={() => startTransition(() => deleteStepAction(routineId, step.id))}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-ink-faint"
            >
              <X size={16} />
            </button>
          </li>
        ))}
      </ol>

      <form
        onSubmit={add}
        className="flex items-center gap-2 rounded-[20px] border-2 border-dashed p-3"
        style={{ borderColor: 'var(--dashed)' }}
      >
        <input
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          placeholder="Add a tiny step…"
          maxLength={120}
          aria-label="New step title"
          className="min-w-0 flex-1 bg-transparent px-2 py-2 text-[15.5px] outline-none placeholder:text-ink-faint"
        />
        <input
          type="number"
          min={1}
          max={120}
          value={newTimer}
          onChange={(e) => setNewTimer(e.target.value)}
          placeholder="min"
          aria-label="Timer minutes (optional)"
          className="w-16 rounded-xl bg-surface-tint px-2 py-2 text-center outline-none placeholder:text-ink-faint"
        />
        <button
          disabled={pending || !newTitle.trim()}
          className="h-11 shrink-0 rounded-full bg-primary px-5 text-sm font-bold text-on-primary disabled:opacity-40"
        >
          Add
        </button>
      </form>
    </section>
  );
}
