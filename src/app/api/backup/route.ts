// Premium backup: download all of the user's data as one JSON file.
import { NextResponse } from 'next/server';
import { createClient, getSessionUser } from '@/lib/supabase/server';
import { getSubscription } from '@/lib/db';
import { canUseFeature } from '@/core/entitlements';

export async function GET() {
  const supabase = await createClient();
  const user = await getSessionUser(supabase);
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const sub = await getSubscription(supabase, user.id);
  if (!canUseFeature('backup', sub)) {
    return NextResponse.json({ error: 'premium required' }, { status: 402 });
  }

  // RLS scopes every query to this user automatically.
  const [routines, steps, completions, streaks, freezes] = await Promise.all([
    supabase.from('routines').select('*'),
    supabase.from('steps').select('*'),
    supabase.from('completions').select('*'),
    supabase.from('streaks').select('*'),
    supabase.from('freeze_events').select('*'),
  ]);

  return new NextResponse(
    JSON.stringify(
      {
        exportedAt: new Date().toISOString(),
        routines: routines.data,
        steps: steps.data,
        completions: completions.data,
        streaks: streaks.data,
        freezeEvents: freezes.data,
      },
      null,
      2,
    ),
    {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': 'attachment; filename="tinysteps-backup.json"',
      },
    },
  );
}
