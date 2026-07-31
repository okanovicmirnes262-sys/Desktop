'use client';

// Premium: bring back a recently broken streak (once a month).
import { useState, useTransition } from 'react';
import { reviveStreakAction } from '@/lib/actions';

export function ReviveStreakButton({ routineId }: { routineId: string }) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  if (message) {
    return <p className="mt-3 text-xs font-semibold text-ink-soft">{message}</p>;
  }
  return (
    <button
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const res = await reviveStreakAction(routineId);
          if (res.ok) setMessage(`Streak revived — back to ${res.restored} days. Welcome back.`);
          else if (res.error === 'limit') setMessage('Revival already used this month.');
          else if (res.error === 'nothing') setMessage('No recent streak to revive here.');
          else setMessage('Revival is a Premium feature.');
        })
      }
      className="mt-3 w-full rounded-full bg-accent px-5 py-2.5 text-sm font-bold text-accent-ink transition-transform active:scale-[0.98] disabled:opacity-50"
    >
      {pending ? 'One sec…' : 'Revive this streak'}
    </button>
  );
}
