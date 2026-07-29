import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import * as db from '@/lib/db';
import { RunPlayer } from '@/components/RunPlayer';

export default async function RunPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const routine = await db.getRoutine(supabase, id);
  if (!routine) notFound();
  const steps = await db.listSteps(supabase, id);

  return (
    <main className="flex min-h-[calc(100vh-8rem)] flex-col">
      <RunPlayer routine={routine} steps={steps} />
    </main>
  );
}
