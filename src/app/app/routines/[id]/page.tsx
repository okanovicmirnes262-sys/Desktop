import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { createClient, getSessionUser } from '@/lib/supabase/server';
import * as db from '@/lib/db';
import { hasPremium } from '@/core/entitlements';
import { RoutineForm } from '@/components/RoutineForm';
import { StepEditor } from '@/components/StepEditor';
import { DeleteRoutineButton } from '@/components/DeleteRoutineButton';
import { RoutineIcon } from '@/components/icons';

export default async function EditRoutinePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const routine = await db.getRoutine(supabase, id); // RLS hides others' routines
  if (!routine) notFound();
  const user = await getSessionUser(supabase);
  const [steps, sub] = await Promise.all([
    db.listSteps(supabase, id),
    user ? db.getSubscription(supabase, user.id) : Promise.resolve(null),
  ]);
  const premium = hasPremium(sub);

  return (
    <main className="flex flex-col gap-7">
      <header className="flex items-center gap-3">
        <Link
          href="/app"
          aria-label="Back"
          className="shadow-card flex h-10 w-10 items-center justify-center rounded-[14px] bg-card text-ink"
        >
          <ChevronLeft size={20} />
        </Link>
        <span className="flex h-10 w-10 items-center justify-center rounded-[14px] bg-surface-alt text-primary">
          <RoutineIcon value={routine.emoji} size={18} />
        </span>
        <h1 className="truncate text-2xl font-bold tracking-[-0.01em]">{routine.name}</h1>
      </header>

      <StepEditor routineId={routine.id} steps={steps} />

      <details className="shadow-card rounded-card bg-card p-5">
        <summary className="cursor-pointer text-[17px] font-bold">Routine settings</summary>
        <div className="mt-5">
          <RoutineForm routine={routine} premium={premium} />
        </div>
      </details>

      <DeleteRoutineButton routineId={routine.id} name={routine.name} />
    </main>
  );
}
