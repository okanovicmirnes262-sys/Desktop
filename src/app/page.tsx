import Link from "next/link";

// Public landing page. Logged-in users are redirected to /app by middleware.
export default function LandingPage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-6 py-12">
      <div className="rounded-card bg-ink p-8 text-on-ink">
        <p className="text-5xl" aria-hidden>
          ☺
        </p>
        <h1 className="mt-6 text-4xl font-semibold tracking-tight">TinySteps</h1>
        <p className="mt-3 text-lg leading-relaxed text-on-ink/80">
          Routines in tiny steps. One thing at a time. Streaks that forgive a
          bad day.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-card bg-sky p-5">
          <p className="text-2xl" aria-hidden>⏱</p>
          <p className="mt-2 font-medium leading-snug">Visual timers for time blindness</p>
        </div>
        <div className="rounded-card bg-mint p-5">
          <p className="text-2xl" aria-hidden>🧊</p>
          <p className="mt-2 font-medium leading-snug">Streak freezes protect a missed day</p>
        </div>
      </div>

      <Link
        href="/login"
        className="mt-2 block rounded-full bg-ink px-8 py-5 text-center text-lg font-semibold text-on-ink transition-transform active:scale-95"
      >
        Get started
      </Link>
      <p className="text-center text-sm text-ink-soft">
        Free for up to 3 routines. Premium €5/month or €40/year.
      </p>
    </main>
  );
}
