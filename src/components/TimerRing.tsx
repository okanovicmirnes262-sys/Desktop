'use client';

// Visual countdown for time blindness: a big ring that visibly drains.
// Calm colors on purpose — no alarm-red panic states. The global
// prefers-reduced-motion CSS turns the smooth transition into stepped
// once-a-second updates automatically.
//
// To restart a timer, remount it with a different React `key`.

import { useEffect, useRef, useState } from 'react';

interface TimerRingProps {
  totalSeconds: number;
  running: boolean;
  onFinish?: () => void;
  size?: number;
}

export function TimerRing({ totalSeconds, running, onFinish, size = 260 }: TimerRingProps) {
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

  const stroke = 18;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const fraction = totalSeconds === 0 ? 0 : remaining / totalSeconds;

  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;

  return (
    <div
      className="relative"
      style={{ width: size, height: size }}
      role="timer"
      aria-label={`${mins} minutes ${secs} seconds remaining`}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--line)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={remaining === 0 ? 'var(--mint)' : 'var(--sky-deep)'}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - fraction)}
          style={{ transition: 'stroke-dashoffset 300ms linear' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-6xl font-semibold tabular-nums tracking-tight">
          {mins}:{String(secs).padStart(2, '0')}
        </span>
        {remaining === 0 && <span className="mt-1 text-ink-soft">Time&apos;s up</span>}
      </div>
    </div>
  );
}
