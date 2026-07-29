import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { getProfile } from '@/lib/db';

// Authenticated shell: content + a fixed 3-item bottom nav. Deliberately
// minimal — one list, one stats view, one settings view.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Premium themes are applied via a data attribute on the shell.
  let theme = 'default';
  if (user) {
    try {
      theme = (await getProfile(supabase, user.id)).theme;
    } catch {
      // profile row may lag right after signup — default theme is fine
    }
  }

  return (
    <div data-theme={theme} className="flex min-h-screen flex-col bg-paper">
      <div className="mx-auto w-full max-w-md flex-1 px-5 pb-28 pt-6">{children}</div>

      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 border-t border-line bg-card/95 backdrop-blur"
      >
        <div className="mx-auto flex max-w-md items-stretch justify-around">
          {[
            { href: '/app', label: 'Today', icon: '☀️' },
            { href: '/app/stats', label: 'Stats', icon: '📈' },
            { href: '/app/settings', label: 'Settings', icon: '⚙️' },
          ].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex min-w-24 flex-col items-center gap-0.5 px-4 py-3 text-xs font-medium text-ink-soft"
            >
              <span className="text-xl" aria-hidden>
                {item.icon}
              </span>
              {item.label}
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}
