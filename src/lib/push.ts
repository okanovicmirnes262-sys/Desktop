// Server-side Web Push sender. Reminder copy lives here: firm and clear,
// never guilt-based.
import webpush from 'web-push';

let configured = false;

function ensureConfigured() {
  if (configured) return;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT ?? 'mailto:hello@example.com',
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  );
  configured = true;
}

export interface PushTarget {
  endpoint: string;
  p256dh: string;
  auth: string;
}

/** Returns false when the subscription is dead and should be deleted. */
export async function sendPush(
  target: PushTarget,
  payload: { title: string; body: string; tag?: string; url?: string },
): Promise<boolean> {
  ensureConfigured();
  try {
    await webpush.sendNotification(
      { endpoint: target.endpoint, keys: { p256dh: target.p256dh, auth: target.auth } },
      JSON.stringify(payload),
    );
    return true;
  } catch (err) {
    const status = (err as { statusCode?: number }).statusCode;
    if (status === 404 || status === 410) return false; // endpoint expired
    throw err;
  }
}

/** Firm, clear reminder copy — states the plan, no nagging or guilt. */
export function reminderCopy(routineName: string, time: string) {
  return {
    title: `${routineName} — ${time}`,
    body: `It's time. Open TinySteps and take the first step.`,
    tag: `reminder`,
    url: '/app',
  };
}
