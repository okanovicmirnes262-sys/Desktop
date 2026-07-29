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
      renewal_period_end?: string | null;
      metadata?: { userId?: string };
    };
  };

  // Our checkout links carry metadata[userId], so events map straight back.
  const userId = event.data?.metadata?.userId;
  if (!userId) return NextResponse.json({ ok: true, skipped: 'no userId metadata' });

  const active =
    event.action === 'membership.went_valid' ||
    event.data?.status === 'active' ||
    event.data?.status === 'trialing';

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
    currentPeriodEnd: event.data?.renewal_period_end ?? null,
  });

  return NextResponse.json({ ok: true });
}
