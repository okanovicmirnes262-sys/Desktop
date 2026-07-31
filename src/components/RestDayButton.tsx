'use client';

// "Taking today off" — a planned skip that keeps the streak alive without
// spending a freeze. Rendered as a quiet tertiary link.

import { useState, useTransition } from 'react';
import { takeRestDayAction } from '@/lib/actions';
import { REST_DAYS_PER_MONTH } from '@/core/streak';

export function RestDayButton({ routineId }: { routineId: string }) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  if (message) {
    return <p className="py-1.5 text-xs font-semibold text-ink-faint">{message}</p>;
  }

  return (
    <button
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const res = await takeRestDayAction(routineId);
          if (!res.ok && res.error === 'limit') {
            setMessage(`Rest days used up this month (${REST_DAYS_PER_MONTH}/month)`);
          }
        })
      }
      className="py-1.5 text-xs font-semibold text-ink-faint disabled:opacity-50"
    >
      {pending ? 'One sec…' : 'Taking today off'}
    </button>
  );
}
