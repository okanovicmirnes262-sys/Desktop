'use client';

// Step list editor: add, rename, delete, reorder. Reordering uses big
// up/down buttons instead of drag-and-drop — reliable, accessible, and
// works identically on touch.

import { useState, useTransition } from 'react';
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

  function move(index: number, dir: -1 | 1) {
    const ids = steps.map((s) => s.id);
    const target = index + dir;
    if (target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target], ids[index]];
    startTransition(() => reorderStepsAction(routineId, ids));
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
      <h2 className="px-1 text-sm font-medium text-ink-soft">
        Steps — small enough that starting feels easy
      </h2>

      <ol className="flex flex-col gap-2">
        {steps.map((step, i) => (
          <li key={step.id} className="flex items-center gap-2 rounded-2xl bg-card p-3">
            <div className="flex flex-col">
              <button
                aria-label={`Move "${step.title}" up`}
                disabled={i === 0 || pending}
                onClick={() => move(i, -1)}
                className="h-8 w-10 rounded-lg text-ink-soft disabled:opacity-25"
              >
                ▲
              </button>
              <button
                aria-label={`Move "${step.title}" down`}
                disabled={i === steps.length - 1 || pending}
                onClick={() => move(i, 1)}
                className="h-8 w-10 rounded-lg text-ink-soft disabled:opacity-25"
              >
                ▼
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
              className="min-w-0 flex-1 rounded-xl bg-transparent px-2 py-2 text-lg outline-none focus:bg-paper"
            />

            {step.timerSeconds ? (
              <span className="shrink-0 rounded-full bg-sky px-2.5 py-1 text-sm font-medium">
                ⏱ {Math.round(step.timerSeconds / 60)}m
              </span>
            ) : null}

            <button
              aria-label={`Delete "${step.title}"`}
              disabled={pending}
              onClick={() => startTransition(() => deleteStepAction(routineId, step.id))}
              className="h-11 w-11 shrink-0 rounded-xl text-ink-soft hover:bg-blush"
            >
              ✕
            </button>
          </li>
        ))}
      </ol>

      <form onSubmit={add} className="flex items-center gap-2 rounded-2xl border-2 border-dashed border-line p-3">
        <input
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          placeholder="Add a tiny step…"
          maxLength={120}
          aria-label="New step title"
          className="min-w-0 flex-1 bg-transparent px-2 py-2 text-lg outline-none"
        />
        <input
          type="number"
          min={1}
          max={120}
          value={newTimer}
          onChange={(e) => setNewTimer(e.target.value)}
          placeholder="min"
          aria-label="Timer minutes (optional)"
          className="w-16 rounded-xl border border-line bg-card px-2 py-2 text-center outline-none"
        />
        <button
          disabled={pending || !newTitle.trim()}
          className="h-11 shrink-0 rounded-full bg-ink px-5 font-semibold text-on-ink disabled:opacity-40"
        >
          Add
        </button>
      </form>
    </section>
  );
}
