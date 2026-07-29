'use client';

// Settings toggle for push reminders on this device: registers the
// service worker, asks permission, stores the subscription server-side.

import { useEffect, useState } from 'react';

type PushState = 'unsupported' | 'off' | 'on' | 'denied' | 'busy';

function urlBase64ToUint8Array(base64: string) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export function PushManager() {
  const [state, setState] = useState<PushState>('busy');

  useEffect(() => {
    (async () => {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        setState('unsupported');
        return;
      }
      if (Notification.permission === 'denied') {
        setState('denied');
        return;
      }
      const reg = await navigator.serviceWorker.register('/sw.js');
      const sub = await reg.pushManager.getSubscription();
      setState(sub ? 'on' : 'off');
    })();
  }, []);

  async function enable() {
    setState('busy');
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setState(permission === 'denied' ? 'denied' : 'off');
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(
          process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
        ),
      });
      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sub.toJSON()),
      });
      setState('on');
    } catch {
      setState('off');
    }
  }

  async function disable() {
    setState('busy');
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      await fetch('/api/push/subscribe', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: sub.endpoint }),
      });
      await sub.unsubscribe();
    }
    setState('off');
  }

  if (state === 'unsupported') {
    return <p className="text-sm text-ink-soft">Push isn&apos;t supported in this browser.</p>;
  }
  if (state === 'denied') {
    return (
      <p className="text-sm text-ink-soft">
        Notifications are blocked for this site — allow them in your browser settings to get
        reminders.
      </p>
    );
  }
  return (
    <button
      onClick={state === 'on' ? disable : enable}
      disabled={state === 'busy'}
      className={`w-full rounded-full px-6 py-4 text-lg font-semibold transition-transform active:scale-95 disabled:opacity-50 ${
        state === 'on' ? 'bg-mint' : 'bg-ink text-white'
      }`}
    >
      {state === 'busy'
        ? 'One sec…'
        : state === 'on'
          ? 'Reminders on for this device ✓ (tap to turn off)'
          : 'Turn on reminders for this device'}
    </button>
  );
}
