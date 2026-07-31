'use client';

// Floating pill tab bar. Client component so the active tab follows the
// current route (primary color = where you are).

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BarChart2, Home, Plus, Settings, Snowflake } from 'lucide-react';

const TABS = [
  { href: '/app', label: 'Today', icon: Home, exact: true },
  { href: '/app/stats', label: 'Stats', icon: BarChart2, exact: false },
  { href: '/app/freezes', label: 'Freezes', icon: Snowflake, exact: false },
  { href: '/app/settings', label: 'More', icon: Settings, exact: false },
];

export function TabBar() {
  const pathname = usePathname();

  const items = TABS.map(({ href, label, icon: Icon, exact }) => {
    const active = exact ? pathname === href : pathname.startsWith(href);
    return (
      <Link
        key={href}
        href={href}
        aria-current={active ? 'page' : undefined}
        className={`flex min-w-14 flex-col items-center gap-1 transition-colors ${
          active ? 'text-primary' : 'text-ink-faint'
        }`}
      >
        <Icon size={19} strokeWidth={2} />
        <span className="text-[9.5px] font-semibold uppercase tracking-[0.08em]">{label}</span>
      </Link>
    );
  });

  return (
    <nav aria-label="Main" className="fixed inset-x-0 bottom-4 px-[22px]">
      <div className="shadow-bar mx-auto flex max-w-md items-center justify-between rounded-[28px] bg-card px-5 py-3">
        {items[0]}
        {items[1]}
        <Link
          href="/app/routines/new"
          aria-label="Add a routine"
          className="shadow-fab flex h-[54px] w-[54px] items-center justify-center rounded-full bg-accent text-accent-ink transition-transform active:scale-95"
        >
          <Plus size={24} strokeWidth={2.5} />
        </Link>
        {items[2]}
        {items[3]}
      </div>
    </nav>
  );
}
