'use client';

// Client controls for the Settings screen: pill toggles, the appearance
// segmented control, and the timezone sync helper.

import { useState, useSyncExternalStore, useTransition } from 'react';
import { updateTimezoneAction, updateWeeklyEmailAction } from '@/lib/actions';
import { SOUND_PREF_KEY } from '@/components/RunPlayer';

/** 50×30 pill toggle from the design system. */
export function Toggle({
  on,
  disabled,
  onChange,
  label,
}: {
  on: boolean;
  disabled?: boolean;
  onChange: (next: boolean) => void;
  label: string;
}) {
  return (
    <button
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className="relative h-[30px] w-[50px] shrink-0 rounded-full p-[3px] transition-colors disabled:opacity-50"
      style={{ background: on ? 'var(--primary)' : '#dcd9f2' }}
    >
      <span
        className="block h-6 w-6 rounded-full bg-white transition-transform duration-150"
        style={{ transform: on ? 'translateX(20px)' : 'translateX(0)' }}
      />
    </button>
  );
}

// ---- appearance (light / dark / system) -----------------------------------

type Appearance = 'light' | 'dark' | 'system';

const appearanceListeners = new Set<() => void>();
const appearanceStore = {
  subscribe(cb: () => void) {
    appearanceListeners.add(cb);
    return () => appearanceListeners.delete(cb);
  },
  get: (): Appearance => {
    const v = localStorage.getItem('ts-appearance');
    return v === 'light' || v === 'dark' ? v : 'system';
  },
  getServer: (): Appearance => 'system',
  set(value: Appearance) {
    if (value === 'system') {
      localStorage.removeItem('ts-appearance');
      delete document.documentElement.dataset.appearance;
    } else {
      localStorage.setItem('ts-appearance', value);
      document.documentElement.dataset.appearance = value;
    }
    appearanceListeners.forEach((cb) => cb());
  },
};

export function AppearanceControl() {
  const value = useSyncExternalStore(
    appearanceStore.subscribe,
    appearanceStore.get,
    appearanceStore.getServer,
  );
  const options: { key: Appearance; label: string }[] = [
    { key: 'light', label: 'Light' },
    { key: 'dark', label: 'Dark' },
    { key: 'system', label: 'System' },
  ];
  return (
    <div className="flex rounded-2xl bg-surface-tint p-1" role="radiogroup" aria-label="Appearance">
      {options.map((o) => (
        <button
          key={o.key}
          role="radio"
          aria-checked={value === o.key}
          onClick={() => appearanceStore.set(o.key)}
          className={`flex-1 rounded-[13px] py-2 text-sm font-semibold transition-colors ${
            value === o.key ? 'bg-card text-ink' : 'text-ink-faint'
          }`}
          style={value === o.key ? { boxShadow: '0 3px 8px rgba(42,39,96,.1)' } : undefined}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ---- sound ---------------------------------------------------------------

const soundListeners = new Set<() => void>();
const soundStore = {
  subscribe(cb: () => void) {
    soundListeners.add(cb);
    return () => soundListeners.delete(cb);
  },
  get: () => localStorage.getItem(SOUND_PREF_KEY) !== 'off',
  getServer: () => true,
  set(on: boolean) {
    localStorage.setItem(SOUND_PREF_KEY, on ? 'on' : 'off');
    soundListeners.forEach((cb) => cb());
  },
};

export function SoundToggle() {
  const on = useSyncExternalStore(soundStore.subscribe, soundStore.get, soundStore.getServer);
  return <Toggle on={on} onChange={(next) => soundStore.set(next)} label="Celebration sound" />;
}

// ---- weekly email ---------------------------------------------------------

export function WeeklyEmailToggle({ initial }: { initial: boolean }) {
  const [on, setOn] = useState(initial);
  const [pending, startTransition] = useTransition();
  return (
    <Toggle
      on={on}
      disabled={pending}
      label="Weekly summary email"
      onChange={(next) => {
        setOn(next);
        startTransition(() => updateWeeklyEmailAction(next));
      }}
    />
  );
}

// ---- timezone -------------------------------------------------------------

export function TimezoneSync({ current }: { current: string }) {
  const [pending, startTransition] = useTransition();
  const device = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const matches = device === current;

  if (matches) {
    return <p className="text-xs text-ink-soft">Streak days and reminders use {current}.</p>;
  }
  return (
    <button
      disabled={pending}
      onClick={() => startTransition(() => updateTimezoneAction(device))}
      className="rounded-full bg-surface-alt px-5 py-2.5 text-sm font-semibold text-primary disabled:opacity-50"
    >
      {pending ? 'Saving…' : `Switch to this device's timezone (${device})`}
    </button>
  );
}
