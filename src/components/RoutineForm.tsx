'use client';

// Create/edit form for a routine's own settings (steps are edited in
// StepEditor). One column, large controls, nothing clever.

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Routine } from '@/core/types';
import { createRoutineAction, updateRoutineAction } from '@/lib/actions';

const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const EMOJI_CHOICES = ['🌅', '🌙', '💪', '🧹', '📚', '💊', '🧘', '✨'];
const COLOR_CHOICES = [
  { key: null, label: 'Auto', swatch: 'linear-gradient(135deg, var(--sky), var(--blush))' },
  { key: 'sky', label: 'Sky', swatch: 'var(--sky)' },
  { key: 'mint', label: 'Mint', swatch: 'var(--mint)' },
  { key: 'blush', label: 'Blush', swatch: 'var(--blush)' },
  { key: 'butter', label: 'Butter', swatch: 'var(--butter)' },
] as const;
type ColorKey = (typeof COLOR_CHOICES)[number]['key'];

export function RoutineForm({ routine }: { routine?: Routine }) {
  const router = useRouter();
  const [name, setName] = useState(routine?.name ?? '');
  const [emoji, setEmoji] = useState(routine?.emoji ?? '✨');
  const [color, setColor] = useState<ColorKey>(routine?.color ?? null);
  const [days, setDays] = useState<number[]>(routine?.scheduleDays ?? [0, 1, 2, 3, 4, 5, 6]);
  const [reminder, setReminder] = useState(routine?.reminderTime ?? '');
  const [reminderWeekend, setReminderWeekend] = useState(routine?.reminderTimeWeekend ?? '');
  const [timerMin, setTimerMin] = useState(
    routine?.timerSeconds ? String(Math.round(routine.timerSeconds / 60)) : '',
  );
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function toggleDay(d: number) {
    setDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort()));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (days.length === 0) {
      setError('Pick at least one day.');
      return;
    }
    setBusy(true);
    setError(null);
    const payload = {
      name: name.trim(),
      emoji,
      color,
      scheduleDays: days,
      reminderTime: reminder || null,
      reminderTimeWeekend: reminder && reminderWeekend ? reminderWeekend : null,
      timerSeconds: timerMin ? Number(timerMin) * 60 : null,
    };
    if (routine) {
      await updateRoutineAction(routine.id, payload);
      router.push(`/app/routines/${routine.id}`);
    } else {
      const res = await createRoutineAction(payload);
      if (!res.ok) {
        setError(
          res.error === 'free_limit'
            ? 'The free plan holds 3 routines. Premium removes the limit.'
            : 'Something went wrong. Try again.',
        );
        setBusy(false);
        return;
      }
      router.push(`/app/routines/${res.id}`);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-6">
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">Name</span>
        <input
          required
          maxLength={80}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Morning"
          className="rounded-2xl border border-line bg-card px-5 py-4 text-lg outline-none focus:border-sky-deep"
        />
      </label>

      <fieldset>
        <legend className="text-sm font-medium">Icon</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {EMOJI_CHOICES.map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => setEmoji(e)}
              aria-pressed={emoji === e}
              className={`h-14 w-14 rounded-2xl text-2xl transition-transform active:scale-90 ${
                emoji === e ? 'bg-sky' : 'bg-card border border-line'
              }`}
            >
              {e}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="text-sm font-medium">Card color</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {COLOR_CHOICES.map((c) => (
            <button
              key={c.label}
              type="button"
              onClick={() => setColor(c.key)}
              aria-pressed={color === c.key}
              className={`flex h-14 min-w-16 flex-col items-center justify-center gap-1 rounded-2xl border-2 px-3 text-xs font-medium transition-transform active:scale-90 ${
                color === c.key ? 'border-ink' : 'border-line'
              }`}
            >
              <span className="h-5 w-5 rounded-full" style={{ background: c.swatch }} />
              {c.label}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="text-sm font-medium">Days</legend>
        <div className="mt-2 flex gap-2">
          {DAY_LABELS.map((label, d) => (
            <button
              key={d}
              type="button"
              onClick={() => toggleDay(d)}
              aria-pressed={days.includes(d)}
              aria-label={['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][d]}
              className={`h-12 w-12 rounded-full font-semibold transition-transform active:scale-90 ${
                days.includes(d) ? 'bg-ink text-on-ink' : 'bg-card border border-line text-ink-soft'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </fieldset>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">Reminder time (optional)</span>
        <input
          type="time"
          value={reminder}
          onChange={(e) => setReminder(e.target.value)}
          className="rounded-2xl border border-line bg-card px-5 py-4 text-lg outline-none focus:border-sky-deep"
        />
        <span className="text-sm text-ink-soft">
          A firm nudge at this time on scheduled days.
        </span>
      </label>

      {reminder && (
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">Weekend reminder (optional)</span>
          <input
            type="time"
            value={reminderWeekend}
            onChange={(e) => setReminderWeekend(e.target.value)}
            className="rounded-2xl border border-line bg-card px-5 py-4 text-lg outline-none focus:border-sky-deep"
          />
          <span className="text-sm text-ink-soft">
            Different time for Saturday & Sunday. Empty = same as weekdays.
          </span>
        </label>
      )}

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">Whole-routine timer, minutes (optional)</span>
        <input
          type="number"
          min={1}
          max={360}
          value={timerMin}
          onChange={(e) => setTimerMin(e.target.value)}
          placeholder="e.g. 20"
          className="rounded-2xl border border-line bg-card px-5 py-4 text-lg outline-none focus:border-sky-deep"
        />
      </label>

      {error && (
        <p role="alert" className="rounded-2xl bg-blush px-5 py-3 font-medium">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={busy}
        className="rounded-full bg-ink px-8 py-5 text-lg font-semibold text-on-ink transition-transform active:scale-95 disabled:opacity-50"
      >
        {routine ? 'Save changes' : 'Create routine'}
      </button>
    </form>
  );
}
