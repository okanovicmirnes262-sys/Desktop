// Stores (or removes) a browser's push subscription for the signed-in user.
import { NextResponse } from 'next/server';
import { createClient, getSessionUser } from '@/lib/supabase/server';
import { savePushSubscription } from '@/lib/db';

export async function POST(request: Request) {
  const supabase = await createClient();
  const user = await getSessionUser(supabase);
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await request.json();
  if (!body?.endpoint || !body?.keys?.p256dh || !body?.keys?.auth) {
    return NextResponse.json({ error: 'invalid subscription' }, { status: 400 });
  }
  await savePushSubscription(supabase, user.id, body);
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const supabase = await createClient();
  const user = await getSessionUser(supabase);
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { endpoint } = await request.json();
  await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint);
  return NextResponse.json({ ok: true });
}
