import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { RoutineForm } from '@/components/RoutineForm';

export default function NewRoutinePage() {
  return (
    <main className="flex flex-col gap-6">
      <header className="flex items-center gap-3">
        <Link
          href="/app"
          aria-label="Back"
          className="shadow-card flex h-10 w-10 items-center justify-center rounded-[14px] bg-card text-ink"
        >
          <ChevronLeft size={20} />
        </Link>
        <h1 className="text-2xl font-bold tracking-[-0.01em]">New routine</h1>
      </header>
      <RoutineForm />
    </main>
  );
}
