'use client';

// Visual countdown for time blindness: a conic-gradient ring that fills
// as time elapses, digits in the middle, tap anywhere on it to pause.
// Calm colors — no alarm-red panic states. Restart by remounting with a
// different React `key`.

import { useEffect, useRef, useState } from 'react';

interface TimerRingProps {
  totalSeconds: number;
  running: boolean;
  onFinish?: () => void;
  /** Tap-to-pause handler; the ring is a button when provided. */
  onToggle?: () => void;
  size?: number;
}

export function TimerRing({ totalSeconds, running, onFinish, onToggle, size = 236 }: TimerRingProps) {
  const [remaining, setRemaining] = useState(totalSeconds);
  const endAtRef = useRef<number | null>(null);
  const finishedRef = useRef(false);

  useEffect(() => {
    if (!running) {
      endAtRef.current = null; // pause: keep remaining as-is
      return;
    }
    endAtRef.current = Date.now() + remaining * 1000;
    const tick = setInterval(() => {
      const left = Math.max(0, Math.round((endAtRef.current! - Date.now()) / 1000));
      setRemaining(left);
      if (left === 0 && !finishedRef.current) {
        finishedRef.current = true;
        clearInterval(tick);
        onFinish?.();
      }
    }, 250);
    return () => clearInterval(tick);
    // `remaining` is intentionally read once at (re)start, not a dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

  const elapsedPct = totalSeconds === 0 ? 100 : ((totalSeconds - remaining) / totalSeconds) * 100;
  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  const closing = running && remaining > 0 && remaining <= 10;
  const inner = size - 36;

  const ring = (
    <div
      className={`flex items-center justify-center rounded-full transition-opacity duration-150 ${
        closing ? 'ts-breathe' : ''
      } ${running ? '' : 'opacity-60'}`}
      style={{
        width: size,
        height: size,
        background: `conic-gradient(var(--accent) ${elapsedPct}%, rgba(255,255,255,0.14) 0)`,
      }}
      role="timer"
      aria-label={`${mins} minutes ${secs} seconds remaining${running ? '' : ', paused'}`}
    >
      <div
        className="flex items-center justify-center rounded-full"
        style={{ width: inner, height: inner, background: '#241f4e' }}
      >
        <span
          className="font-extrabold tabular-nums tracking-[-0.02em] text-white"
          style={{ fontSize: 58, lineHeight: 1 }}
        >
          {mins}:{String(secs).padStart(2, '0')}
        </span>
      </div>
    </div>
  );

  if (!onToggle) return ring;
  return (
    <button type="button" onClick={onToggle} aria-pressed={!running} className="rounded-full">
      {ring}
    </button>
  );
}
