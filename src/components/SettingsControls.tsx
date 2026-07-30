'use client';

// Small client controls used on the Settings page.

import { useSyncExternalStore, useTransition } from 'react';
import { updateThemeAction, updateTimezoneAction } from '@/lib/actions';
import { SOUND_PREF_KEY } from '@/components/RunPlayer';

// Tiny external store around localStorage so the toggle reads/writes the
// device preference without effect-driven state (and stays SSR-safe).
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

/** Celebration sound on/off — a device preference, stored locally. */
export function SoundToggle() {
  const on = useSyncExternalStore(soundStore.subscribe, soundStore.get, soundStore.getServer);

  return (
    <button
      role="switch"
      aria-checked={on}
      onClick={() => soundStore.set(!on)}
      className={`w-full rounded-full px-6 py-4 text-lg font-semibold transition-transform active:scale-95 ${
        on ? 'bg-mint' : 'bg-paper text-ink-soft'
      }`}
    >
      {on ? 'Celebration sound on 🔔 (tap to mute)' : 'Celebration sound off 🔕'}
    </button>
  );
}

export function TimezoneSync({ current }: { current: string }) {
  const [pending, startTransition] = useTransition();
  const device = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const matches = device === current;

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-ink-soft">
        Streak days and reminders use <strong>{current}</strong>.
      </p>
      {!matches && (
        <button
          disabled={pending}
          onClick={() => startTransition(() => updateTimezoneAction(device))}
          className="rounded-full bg-sky px-6 py-3 font-semibold transition-transform active:scale-95 disabled:opacity-50"
        >
          {pending ? 'Saving…' : `Switch to this device's timezone (${device})`}
        </button>
      )}
    </div>
  );
}

const THEMES = [
  { key: 'default', label: 'Paper', swatch: '#bfdff2' },
  { key: 'dusk', label: 'Dusk', swatch: '#ccc7ee' },
  { key: 'meadow', label: 'Meadow', swatch: '#cfe8c9' },
];

export function ThemePicker({ current, premium }: { current: string; premium: boolean }) {
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex gap-3">
      {THEMES.map((t) => {
        const locked = t.key !== 'default' && !premium;
        return (
          <button
            key={t.key}
            disabled={pending || locked}
            aria-pressed={current === t.key}
            onClick={() => startTransition(() => updateThemeAction(t.key))}
            className={`flex flex-1 flex-col items-center gap-2 rounded-2xl border-2 p-4 transition-transform active:scale-95 ${
              current === t.key ? 'border-ink' : 'border-line'
            } ${locked ? 'opacity-50' : ''}`}
          >
            <span className="h-8 w-8 rounded-full" style={{ background: t.swatch }} />
            <span className="text-sm font-medium">
              {t.label}
              {locked ? ' 🔒' : ''}
            </span>
          </button>
        );
      })}
    </div>
  );
}
