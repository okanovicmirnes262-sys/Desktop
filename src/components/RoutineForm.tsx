'use client';

// Create/edit form for a routine (steps are edited in StepEditor).
// Indigo design: uppercase labels, tile grids, one fixed primary action.

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Routine } from '@/core/types';
import { createRoutineAction, updateRoutineAction } from '@/lib/actions';
import { ICON_CHOICES, ROUTINE_ICONS, iconKeyOf } from '@/components/icons';

const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export function RoutineForm({ routine, premium = false }: { routine?: Routine; premium?: boolean }) {
  const router = useRouter();
  const [name, setName] = useState(routine?.name ?? '');
  const [icon, setIcon] = useState(routine ? iconKeyOf(routine.emoji) : 'sun');
  const [days, setDays] = useState<number[]>(routine?.scheduleDays ?? [0, 1, 2, 3, 4, 5, 6]);
  const [reminder, setReminder] = useState(routine?.reminderTime ?? '');
  const [reminderWeekend, setReminderWeekend] = useState(routine?.reminderTimeWeekend ?? '');
  const [extra1, setExtra1] = useState(routine?.reminderTimesExtra?.[0] ?? '');
  const [extra2, setExtra2] = useState(routine?.reminderTimesExtra?.[1] ?? '');
  const [secondBell, setSecondBell] = useState(routine?.secondBell ?? false);
  const [timerMin, setTimerMin] = useState(
    routine?.timerSeconds ? String(Math.round(routine.timerSeconds / 60)) : '',
  );
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const valid = name.trim().length > 0 && days.length > 0;

  function toggleDay(d: number) {
    setDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort()));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid) return;
    setBusy(true);
    setError(null);
    const payload = {
      name: name.trim(),
      emoji: icon, // legacy column stores the icon key
      color: null,
      scheduleDays: days,
      reminderTime: reminder || null,
      reminderTimeWeekend: reminder && reminderWeekend ? reminderWeekend : null,
      reminderTimesExtra: premium && reminder ? [extra1, extra2].filter(Boolean) : [],
      secondBell: premium && Boolean(reminder) && secondBell,
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
    <form onSubmit={submit} className="flex flex-col gap-6 pb-24">
      <div className="flex flex-col gap-2">
        <label htmlFor="routine-name" className="ts-label">
          Name it
        </label>
        <input
          id="routine-name"
          required
          maxLength={80}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Morning"
          className="shadow-card rounded-[20px] bg-card px-5 py-4 text-[17px] font-semibold text-primary outline-none placeholder:text-ink-faint"
        />
        <p className="text-xs text-ink-soft">
          Keep it small. &ldquo;Morning&rdquo; beats &ldquo;Perfect 6am routine&rdquo;.
        </p>
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="ts-label mb-2">Icon</legend>
        <div className="grid grid-cols-5 gap-2.5">
          {ICON_CHOICES.map((key) => {
            const Icon = ROUTINE_ICONS[key];
            const selected = icon === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setIcon(key)}
                aria-pressed={selected}
                aria-label={key}
                className={`flex aspect-square items-center justify-center rounded-[18px] transition-colors ${
                  selected ? 'bg-primary text-on-primary' : 'shadow-card bg-card text-ink-label'
                }`}
              >
                <Icon size={20} strokeWidth={2} />
              </button>
            );
          })}
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="ts-label mb-2">Days</legend>
        <div className="grid grid-cols-7 gap-2">
          {DAY_LABELS.map((label, d) => (
            <button
              key={d}
              type="button"
              onClick={() => toggleDay(d)}
              aria-pressed={days.includes(d)}
              aria-label={['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][d]}
              className={`flex aspect-square items-center justify-center rounded-2xl text-sm font-bold transition-colors ${
                days.includes(d)
                  ? 'bg-primary text-on-primary'
                  : 'shadow-card bg-card text-ink-faint'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="flex flex-col gap-2">
        <label htmlFor="reminder-time" className="ts-label">
          Reminder
        </label>
        <input
          id="reminder-time"
          type="time"
          value={reminder}
          onChange={(e) => setReminder(e.target.value)}
          className="shadow-card rounded-[20px] bg-card px-5 py-4 text-lg font-bold tabular-nums outline-none"
        />
        <p className="text-xs text-ink-soft">A warm nudge at this time on scheduled days.</p>
      </div>

      {reminder && (
        <div className="flex flex-col gap-2">
          <label htmlFor="reminder-weekend" className="ts-label">
            Weekend reminder (optional)
          </label>
          <input
            id="reminder-weekend"
            type="time"
            value={reminderWeekend}
            onChange={(e) => setReminderWeekend(e.target.value)}
            className="shadow-card rounded-[20px] bg-card px-5 py-4 text-lg font-bold tabular-nums outline-none"
          />
          <p className="text-xs text-ink-soft">
            Different time for Saturday &amp; Sunday. Empty = same as weekdays.
          </p>
        </div>
      )}

      {reminder && premium && (
        <div className="flex flex-col gap-3">
          <p className="ts-label">More reminders (Premium)</p>
          <div className="grid grid-cols-2 gap-2.5">
            <input
              type="time"
              value={extra1}
              onChange={(e) => setExtra1(e.target.value)}
              aria-label="Extra reminder 1"
              className="shadow-card rounded-[20px] bg-card px-4 py-3.5 text-base font-bold tabular-nums outline-none"
            />
            <input
              type="time"
              value={extra2}
              onChange={(e) => setExtra2(e.target.value)}
              aria-label="Extra reminder 2"
              className="shadow-card rounded-[20px] bg-card px-4 py-3.5 text-base font-bold tabular-nums outline-none"
            />
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={secondBell}
            onClick={() => setSecondBell(!secondBell)}
            className={`rounded-[20px] px-5 py-3.5 text-left text-sm font-semibold transition-colors ${
              secondBell ? 'bg-primary text-on-primary' : 'shadow-card bg-card text-ink-soft'
            }`}
          >
            Second bell — one repeat nudge 30 min later if not started
          </button>
        </div>
      )}

      {reminder && !premium && (
        <p className="text-xs text-ink-soft">
          Premium adds up to 2 more reminder times and a &ldquo;second bell&rdquo; repeat nudge.
        </p>
      )}

      <div className="flex flex-col gap-2">
        <label htmlFor="routine-timer" className="ts-label">
          Whole-routine timer, minutes (optional)
        </label>
        <input
          id="routine-timer"
          type="number"
          min={1}
          max={360}
          value={timerMin}
          onChange={(e) => setTimerMin(e.target.value)}
          placeholder="e.g. 20"
          className="shadow-card rounded-[20px] bg-card px-5 py-4 text-lg font-bold tabular-nums outline-none placeholder:font-normal placeholder:text-ink-faint"
        />
      </div>

      {error && (
        <p role="alert" className="rounded-[20px] bg-blush px-5 py-3 text-sm font-semibold">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={busy || !valid}
        className="rounded-[22px] bg-primary px-8 py-[18px] text-[17px] font-bold text-on-primary transition-colors hover:bg-primary-hover disabled:opacity-45"
      >
        {busy ? 'One sec…' : routine ? 'Save changes' : 'Create routine'}
      </button>
    </form>
  );
}
