import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import * as db from '@/lib/db';
import { RoutineForm } from '@/components/RoutineForm';
import { StepEditor } from '@/components/StepEditor';
import { DeleteRoutineButton } from '@/components/DeleteRoutineButton';

export default async function EditRoutinePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const routine = await db.getRoutine(supabase, id); // RLS hides others' routines
  if (!routine) notFound();
  const steps = await db.listSteps(supabase, id);

  return (
    <main className="flex flex-col gap-8">
      <header className="flex items-center gap-3">
        <Link href="/app" aria-label="Back" className="text-2xl">
          ←
        </Link>
        <h1 className="truncate text-2xl font-semibold tracking-tight">
          {routine.emoji} {routine.name}
        </h1>
      </header>

      <StepEditor routineId={routine.id} steps={steps} />

      <details className="rounded-card bg-card p-5">
        <summary className="cursor-pointer text-lg font-semibold">Routine settings</summary>
        <div className="mt-5">
          <RoutineForm routine={routine} />
        </div>
      </details>

      <DeleteRoutineButton routineId={routine.id} name={routine.name} />
    </main>
  );
}
