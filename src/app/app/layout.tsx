import Link from 'next/link';
import { BarChart2, Home, Plus, Settings, Snowflake } from 'lucide-react';

// Authenticated shell: content + the floating pill tab bar with the
// always-available yellow "add a routine" FAB in the middle.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <div className="mx-auto w-full max-w-md flex-1 px-[26px] pb-32 pt-6">{children}</div>

      <nav aria-label="Main" className="fixed inset-x-0 bottom-4 px-[22px]">
        <div className="shadow-bar mx-auto flex max-w-md items-center justify-between rounded-[28px] bg-card px-5 py-3">
          <Link
            href="/app"
            className="flex min-w-14 flex-col items-center gap-1 text-primary"
          >
            <Home size={19} strokeWidth={2} />
            <span className="text-[9.5px] font-semibold uppercase tracking-[0.08em]">Today</span>
          </Link>
          <Link
            href="/app/stats"
            className="flex min-w-14 flex-col items-center gap-1 text-ink-faint"
          >
            <BarChart2 size={19} strokeWidth={2} />
            <span className="text-[9.5px] font-semibold uppercase tracking-[0.08em]">Stats</span>
          </Link>
          <Link
            href="/app/routines/new"
            aria-label="Add a routine"
            className="shadow-fab flex h-[54px] w-[54px] items-center justify-center rounded-full bg-accent text-accent-ink transition-transform active:scale-95"
          >
            <Plus size={24} strokeWidth={2.5} />
          </Link>
          <Link
            href="/app/freezes"
            className="flex min-w-14 flex-col items-center gap-1 text-ink-faint"
          >
            <Snowflake size={19} strokeWidth={2} />
            <span className="text-[9.5px] font-semibold uppercase tracking-[0.08em]">Freezes</span>
          </Link>
          <Link
            href="/app/settings"
            className="flex min-w-14 flex-col items-center gap-1 text-ink-faint"
          >
            <Settings size={19} strokeWidth={2} />
            <span className="text-[9.5px] font-semibold uppercase tracking-[0.08em]">More</span>
          </Link>
        </div>
      </nav>
    </div>
  );
}
