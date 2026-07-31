'use client';

// Destructive action → explicit confirm step, never a single tap.
import { useState, useTransition } from 'react';
import { deleteRoutineAction } from '@/lib/actions';

export function DeleteRoutineButton({ routineId, name }: { routineId: string; name: string }) {
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  if (!confirming) {
    return (
      <button
        onClick={() => setConfirming(true)}
        className="pb-6 text-sm font-semibold text-ink-faint underline underline-offset-4"
      >
        Delete routine
      </button>
    );
  }
  return (
    <div className="shadow-card rounded-card mb-6 bg-card p-5">
      <p className="text-[15px] font-semibold">
        Delete “{name}” and its whole history? This can&apos;t be undone.
      </p>
      <div className="mt-4 flex gap-3">
        <button
          disabled={pending}
          onClick={() => startTransition(() => deleteRoutineAction(routineId))}
          className="flex-1 rounded-full bg-primary px-6 py-3 text-sm font-bold text-on-primary disabled:opacity-50"
        >
          Yes, delete
        </button>
        <button
          onClick={() => setConfirming(false)}
          className="flex-1 rounded-full bg-surface-tint px-6 py-3 text-sm font-bold"
        >
          Keep it
        </button>
      </div>
    </div>
  );
}
