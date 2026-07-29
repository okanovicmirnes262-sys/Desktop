import Link from 'next/link';
import { RoutineForm } from '@/components/RoutineForm';

export default function NewRoutinePage() {
  return (
    <main className="flex flex-col gap-6">
      <header className="flex items-center gap-3">
        <Link href="/app" aria-label="Back" className="text-2xl">
          ←
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">New routine</h1>
      </header>
      <RoutineForm />
    </main>
  );
}
