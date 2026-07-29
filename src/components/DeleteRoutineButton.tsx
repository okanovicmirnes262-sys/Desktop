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
        className="rounded-full px-6 py-3 font-medium text-ink-soft underline underline-offset-4"
      >
        Delete routine
      </button>
    );
  }
  return (
    <div className="rounded-card bg-blush p-5">
      <p className="font-medium">
        Delete “{name}” and its whole history? This can&apos;t be undone.
      </p>
      <div className="mt-4 flex gap-3">
        <button
          disabled={pending}
          onClick={() => startTransition(() => deleteRoutineAction(routineId))}
          className="flex-1 rounded-full bg-ink px-6 py-3 font-semibold text-white disabled:opacity-50"
        >
          Yes, delete
        </button>
        <button
          onClick={() => setConfirming(false)}
          className="flex-1 rounded-full bg-card px-6 py-3 font-semibold"
        >
          Keep it
        </button>
      </div>
    </div>
  );
}
