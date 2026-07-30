'use client';

// "Taking today off" — a planned skip that keeps the streak alive without
// spending a freeze. Limited per month, so the button explains itself.

import { useState, useTransition } from 'react';
import { takeRestDayAction } from '@/lib/actions';
import { REST_DAYS_PER_MONTH } from '@/core/streak';

export function RestDayButton({ routineId }: { routineId: string }) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  if (message) {
    return <p className="mt-2 text-center text-sm font-medium text-ink-soft">{message}</p>;
  }

  return (
    <button
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const res = await takeRestDayAction(routineId);
          if (!res.ok && res.error === 'limit') {
            setMessage(`Rest days are used up for this month (${REST_DAYS_PER_MONTH}/month).`);
          }
        })
      }
      className="mt-2 w-full py-2 text-center text-sm font-medium text-ink-soft underline underline-offset-4 disabled:opacity-50"
    >
      {pending ? 'One sec…' : '☕ Taking today off'}
    </button>
  );
}
