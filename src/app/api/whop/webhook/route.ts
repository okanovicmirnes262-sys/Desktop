// Whop webhook: keeps the subscriptions table truthful when memberships
// start, renew, or lapse. Verified with an HMAC-SHA256 signature over the
// raw body using WHOP_WEBHOOK_SECRET.
import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { upsertSubscription } from '@/lib/db';

function validSignature(raw: string, signature: string | null): boolean {
  const secret = process.env.WHOP_WEBHOOK_SECRET;
  if (!secret || !signature) return false;
  const expected = crypto.createHmac('sha256', secret).update(raw).digest('hex');
  const provided = signature.replace(/^sha256=/, '');
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(provided));
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  const raw = await request.text();
  const signature =
    request.headers.get('x-whop-signature') ?? request.headers.get('whop-signature');
  if (!validSignature(raw, signature)) {
    return NextResponse.json({ error: 'bad signature' }, { status: 401 });
  }

  const event = JSON.parse(raw) as {
    action?: string;
    data?: {
      id?: string;
      status?: string;
      plan_id?: string;
      renewal_period_end?: string | number | null;
      metadata?: { userId?: string };
    };
  };

  // Our checkout links carry metadata[userId], so events map straight back.
  const userId = event.data?.metadata?.userId;
  if (!userId) return NextResponse.json({ ok: true, skipped: 'no userId metadata' });

  // Only act on events that clearly change membership validity — anything
  // else is ignored so a stray event can never downgrade a paying user.
  let active: boolean;
  if (event.action === 'membership.went_valid') active = true;
  else if (event.action === 'membership.went_invalid') active = false;
  else if (event.data?.status === 'active' || event.data?.status === 'trialing') active = true;
  else return NextResponse.json({ ok: true, ignored: event.action ?? 'unknown' });

  // Whop may send the period end as a Unix timestamp — normalize to ISO.
  const rawEnd = event.data?.renewal_period_end;
  const periodEnd =
    typeof rawEnd === 'number' ? new Date(rawEnd * 1000).toISOString() : (rawEnd ?? null);

  const db = createAdminClient();
  await upsertSubscription(db, {
    userId,
    provider: 'whop',
    status: active ? 'active' : 'canceled',
    plan:
      event.data?.plan_id === process.env.NEXT_PUBLIC_WHOP_PLAN_ID_YEARLY
        ? 'yearly'
        : event.data?.plan_id === process.env.NEXT_PUBLIC_WHOP_PLAN_ID_MONTHLY
          ? 'monthly'
          : null,
    currentPeriodEnd: periodEnd,
  });

  return NextResponse.json({ ok: true });
}
