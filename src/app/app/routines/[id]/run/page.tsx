import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import * as db from '@/lib/db';
import { RunPlayer } from '@/components/RunPlayer';
import { todayInTz } from '@/core/dates';

export default async function RunPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const routine = await db.getRoutine(supabase, id);
  if (!routine) notFound();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const [steps, progress, profile] = await Promise.all([
    db.listSteps(supabase, id),
    db.getRunProgress(supabase, id),
    user ? db.getProfile(supabase, user.id) : Promise.resolve(null),
  ]);

  // Offer to resume only when the saved progress is from today.
  const today = profile ? todayInTz(profile.timezone) : null;
  const initialStepIndex = progress && progress.onDate === today ? progress.stepIndex : 0;

  return (
    <main className="flex min-h-[calc(100vh-8rem)] flex-col">
      <RunPlayer routine={routine} steps={steps} initialStepIndex={initialStepIndex} />
    </main>
  );
}
