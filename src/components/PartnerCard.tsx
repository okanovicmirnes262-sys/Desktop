'use client';

// Premium accountability partner: share only your top streak, nothing else.
import { useState, useTransition } from 'react';
import {
  createPartnerInviteAction,
  leavePartnershipAction,
  redeemPartnerCodeAction,
} from '@/lib/actions';

export function PartnerCard({
  partner,
}: {
  partner: { displayName: string | null; topStreak: number } | null;
}) {
  const [pending, startTransition] = useTransition();
  const [code, setCode] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  if (partner) {
    return (
      <div>
        <p className="text-[15px] font-semibold">
          {partner.displayName ?? 'Your partner'} —{' '}
          <span className="text-primary">{partner.topStreak}-day streak</span>
        </p>
        <p className="mt-1 text-xs text-ink-soft">
          You see each other&apos;s top streak. Nothing else is shared.
        </p>
        <button
          disabled={pending}
          onClick={() => startTransition(() => leavePartnershipAction())}
          className="mt-3 text-xs font-semibold text-ink-faint underline underline-offset-4 disabled:opacity-50"
        >
          Unlink partner
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-ink-soft">
        Link up with one friend — you each see only the other&apos;s top streak.
        Showing up is easier when someone&apos;s watching kindly.
      </p>
      {code ? (
        <p className="rounded-[16px] bg-surface-alt px-4 py-3 text-center text-xl font-extrabold tracking-[0.2em] text-primary">
          {code}
        </p>
      ) : (
        <button
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const res = await createPartnerInviteAction();
              if (res.ok) setCode(res.code);
              else setMessage('Partners are a Premium feature.');
            })
          }
          className="rounded-full bg-surface-alt px-5 py-2.5 text-sm font-semibold text-primary disabled:opacity-50"
        >
          {pending ? 'One sec…' : 'Get my invite code'}
        </button>
      )}
      <div className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value.toUpperCase())}
          placeholder="Enter a code"
          maxLength={6}
          className="min-w-0 flex-1 rounded-[16px] bg-surface-tint px-4 py-2.5 text-center text-sm font-bold tracking-[0.15em] outline-none placeholder:font-normal placeholder:tracking-normal placeholder:text-ink-faint"
        />
        <button
          disabled={pending || input.length < 6}
          onClick={() =>
            startTransition(async () => {
              const res = await redeemPartnerCodeAction(input);
              setMessage(res.message);
              if (res.ok) setInput('');
            })
          }
          className="shrink-0 rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-on-primary disabled:opacity-40"
        >
          Link
        </button>
      </div>
      {message && <p className="text-xs font-semibold text-ink-soft">{message}</p>}
    </div>
  );
}
