'use client';

import { useState, useTransition } from 'react';
import { verifyPremiumAction } from '@/lib/actions';

// "I've subscribed" → re-check the Whop membership on demand.
export function VerifyPremiumButton() {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-2">
      <button
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const { premium } = await verifyPremiumAction();
            setResult(
              premium
                ? 'Premium is active — enjoy!'
                : 'No active membership found yet. It can take a minute after checkout.',
            );
          })
        }
        className="shadow-card rounded-[20px] bg-card px-6 py-4 text-[15px] font-bold text-primary transition-transform active:scale-[0.98] disabled:opacity-50"
      >
        {pending ? 'Checking…' : 'I subscribed — check my membership'}
      </button>
      {result && <p className="text-center text-sm font-medium">{result}</p>}
    </div>
  );
}
